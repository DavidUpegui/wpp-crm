import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { WrongCurrentPasswordError } from "@/modules/auth/domain/errors";
import { NewPasswordSameAsCurrentError } from "@/modules/users/domain/errors";
import type { PasswordHasher } from "@/modules/users/domain/password-hasher";
import { assertPasswordMeetsPolicy } from "@/modules/users/domain/password-policy";
import type { SessionRevoker } from "@/modules/users/domain/session-revoker";
import type { UserTransactionRunner } from "@/modules/users/domain/user-transaction-runner";

/** What the "Mi cuenta" password form or the forced change-password screen sends (US-4, US-5). */
export type ChangeOwnPasswordInput = {
  /** The logged-in user changing their own password; their current session is kept (BR-013). */
  currentUser: CurrentUser;
  /**
   * Plain current password, required in "Mi cuenta" (AC-5.3). Ignored during
   * the forced change (plan §11). Never stored, returned or logged.
   */
  currentPassword?: string;
  /** Plain new password; it is hashed here and never stored, returned or logged. */
  newPassword: string;
};

/** The interfaces `changeOwnPassword` needs; the container passes the real ones, tests pass fakes. */
export type ChangeOwnPasswordDependencies = {
  transactionRunner: UserTransactionRunner;
  passwordHasher: PasswordHasher;
  sessionRevoker: SessionRevoker;
};

/**
 * Builds the use case that lets a logged-in user change their own password,
 * either in "Mi cuenta" (FR-011, AC-5.2) or on the forced change-password
 * screen after receiving a temporary password (FR-010, AC-4.2).
 *
 * Checks run cheapest first: the new password must meet the policy (BR-002,
 * otherwise `PasswordPolicyError`). In "Mi cuenta" the current password must
 * be correct (AC-5.3, otherwise `WrongCurrentPasswordError`). The new
 * password must differ from the stored one (BR-002, AC-4.3, otherwise
 * `NewPasswordSameAsCurrentError`).
 *
 * The new hash and the cleared "must change password" flag are written in
 * one transaction, so a rejected change leaves nothing changed. Afterwards
 * the user's sessions on other devices end, but the current one stays
 * (FR-012, BR-013, AC-5.5).
 */
export function makeChangeOwnPassword(dependencies: ChangeOwnPasswordDependencies) {
  const { transactionRunner, passwordHasher, sessionRevoker } = dependencies;

  return async function changeOwnPassword(input: ChangeOwnPasswordInput): Promise<void> {
    const { currentUser, currentPassword, newPassword } = input;

    assertPasswordMeetsPolicy(newPassword);

    // The mode comes from the user's STORED state, never from whether
    // `currentPassword` was sent. If it depended on the presence of
    // `currentPassword`, anyone holding a session (for example on a shared
    // computer) could skip the current-password check just by leaving it out.
    // During the forced change the user authenticated with the temporary
    // password moments ago, so it is not asked again (plan §11).
    const isForcedChange = currentUser.mustChangePassword;

    const storedHash = await readStoredPasswordHash(currentUser.id);

    if (!isForcedChange) {
      await assertCurrentPasswordIsCorrect(currentPassword, storedHash);
    }

    // For the forced change the stored hash is the temporary password, so
    // this also rejects "new password equal to the temporary one" (AC-4.3).
    const isSameAsStored = await passwordHasher.verify({ password: newPassword, hash: storedHash });
    if (isSameAsStored) {
      throw new NewPasswordSameAsCurrentError();
    }

    const newPasswordHash = await passwordHasher.hash(newPassword);

    await transactionRunner.run(async ({ users, credentials }) => {
      await credentials.setPasswordHash(currentUser.id, newPasswordHash);
      await users.setMustChangePassword(currentUser.id, false);
    });

    // Other sessions are revoked only AFTER the new password has committed,
    // so a rejected or rolled-back change never logs the user out elsewhere.
    // The current session is kept so the user stays logged in (BR-013).
    await sessionRevoker.revokeAllForUserExcept(currentUser.id, currentUser.sessionId);
  };

  // The hash is read in its own short transaction, so no database
  // transaction stays open while the (deliberately slow) password hashing runs.
  async function readStoredPasswordHash(userId: string): Promise<string> {
    const storedHash = await transactionRunner.run(({ credentials }) => credentials.getPasswordHash(userId));
    if (!storedHash) {
      // Should never happen: a logged-in user always has a password. Fail
      // closed rather than let the password be set without any check.
      throw new WrongCurrentPasswordError();
    }
    return storedHash;
  }

  async function assertCurrentPasswordIsCorrect(
    currentPassword: string | undefined,
    storedHash: string,
  ): Promise<void> {
    if (!currentPassword) {
      throw new WrongCurrentPasswordError();
    }

    const isCorrect = await passwordHasher.verify({ password: currentPassword, hash: storedHash });
    if (!isCorrect) {
      throw new WrongCurrentPasswordError();
    }
  }
}
