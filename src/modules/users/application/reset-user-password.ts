import type { Actor } from "@/modules/users/domain/actor";
import { assertAdminCanResetPassword } from "@/modules/users/domain/admin-protections";
import { UserNotFoundError } from "@/modules/users/domain/errors";
import type { PasswordHasher } from "@/modules/users/domain/password-hasher";
import { assertPasswordMeetsPolicy } from "@/modules/users/domain/password-policy";
import { assertIsAdmin } from "@/modules/users/domain/permissions";
import type { SessionRevoker } from "@/modules/users/domain/session-revoker";
import type { UserTransactionRunner } from "@/modules/users/domain/user-transaction-runner";

/** What the admin confirms in the "reset password" dialog (US-10). */
export type ResetUserPasswordInput = {
  /** The logged-in user making the change; must be an admin (BR-012). */
  actor: Actor;
  /** The id of the user whose password is reset. */
  userId: string;
  /** Plain temporary password; it is hashed here and never stored, returned or logged. */
  temporaryPassword: string;
};

/** The interfaces `resetUserPassword` needs; the container passes the real ones, tests pass fakes. */
export type ResetUserPasswordDependencies = {
  transactionRunner: UserTransactionRunner;
  passwordHasher: PasswordHasher;
  sessionRevoker: SessionRevoker;
};

/**
 * Builds the use case that lets an admin set a new temporary password for
 * another user (FR-017, AC-10.1). The user must change it at their next
 * login (AC-1.4), and all their sessions end (BR-006).
 *
 * Checks run cheapest first: the actor must be an admin (BR-012, otherwise
 * `ForbiddenError`), then the temporary password must meet the policy
 * (BR-002, otherwise `PasswordPolicyError`). Only then is the password
 * hashed. An unknown user fails with `UserNotFoundError`, and an admin may
 * not reset their own password this way (BR-009, AC-10.2,
 * `CannotModifyOwnAccountError`); they use "Mi cuenta" instead.
 *
 * The new hash and the "must change password" flag are written in one
 * transaction, so a rejected reset leaves nothing changed. No admin lock is
 * needed: a password reset never changes how many active admins exist
 * (BR-008 does not apply).
 */
export function makeResetUserPassword(dependencies: ResetUserPasswordDependencies) {
  return async function resetUserPassword(input: ResetUserPasswordInput): Promise<void> {
    assertIsAdmin(input.actor);
    assertPasswordMeetsPolicy(input.temporaryPassword);
    const passwordHash = await dependencies.passwordHasher.hash(input.temporaryPassword);

    await dependencies.transactionRunner.run(async ({ users, credentials }) => {
      const target = await users.findById(input.userId);
      if (!target) {
        throw new UserNotFoundError();
      }

      // The self-reset check runs on the loaded target (like deactivate and
      // update), so every BR-009 rule lives in one domain function. Hashing
      // before it is cheap, and nothing has been written yet if it throws.
      assertAdminCanResetPassword({ actorId: input.actor.id, target });

      await credentials.setPasswordHash(input.userId, passwordHash);
      await users.setMustChangePassword(input.userId, true);
    });

    // Sessions are revoked only AFTER the new password has committed, so a
    // rejected or rolled-back reset never logs the user out. Even if this
    // revocation failed, the old password no longer works, and users are
    // never cached (plan §1), so on their next request the user is limited
    // to the change-password screen (BR-011).
    await dependencies.sessionRevoker.revokeAllForUser(input.userId);
  };
}
