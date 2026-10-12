import type { Actor } from "@/modules/users/domain/actor";
import { assertAdminCanDeactivate } from "@/modules/users/domain/admin-protections";
import { UserNotFoundError } from "@/modules/users/domain/errors";
import { assertIsAdmin } from "@/modules/users/domain/permissions";
import type { SessionRevoker } from "@/modules/users/domain/session-revoker";
import type { UserTransactionRunner } from "@/modules/users/domain/user-transaction-runner";

/** What the admin confirms in the "Desactivar" dialog (US-9). */
export type DeactivateUserInput = {
  /** The logged-in user making the change; must be an admin (BR-012). */
  actor: Actor;
  /** The id of the user being deactivated. */
  userId: string;
};

/** The interfaces `deactivateUser` needs; the container passes the real ones, tests pass fakes. */
export type DeactivateUserDependencies = {
  transactionRunner: UserTransactionRunner;
  sessionRevoker: SessionRevoker;
};

/**
 * Builds the use case that lets an admin deactivate another user (FR-016,
 * AC-9.1). The user is marked inactive and all their sessions end, so their
 * next action sends them to the login screen (BR-006).
 *
 * The actor must be an admin (BR-012, otherwise `ForbiddenError`). An admin
 * may not deactivate themselves (BR-009, AC-9.3, `CannotModifyOwnAccountError`),
 * and nobody may deactivate the last active admin (BR-008, AC-9.4,
 * `LastActiveAdminError`). An unknown user fails with `UserNotFoundError`.
 * Deactivating a user who is already inactive is harmless: they stay inactive.
 *
 * Lock, check and update all happen in one transaction, so a rejected change
 * leaves nothing changed.
 */
export function makeDeactivateUser(dependencies: DeactivateUserDependencies) {
  return async function deactivateUser(input: DeactivateUserInput): Promise<void> {
    assertIsAdmin(input.actor);

    await dependencies.transactionRunner.run(async ({ users }) => {
      // Lock the active admins FIRST, before reading the target. If two admins
      // deactivate each other at the same time, the second transaction waits
      // here until the first one commits, and then sees the new count. Reading
      // the target first could let both pass the BR-008 check with stale data.
      const activeAdminCount = await users.lockActiveAdmins();

      const target = await users.findById(input.userId);
      if (!target) {
        throw new UserNotFoundError();
      }

      assertAdminCanDeactivate({ actorId: input.actor.id, target, activeAdminCount });

      await users.setStatus(input.userId, "inactive");
    });

    // Sessions are revoked only AFTER the status change has committed, so a
    // rejected or rolled-back deactivation never logs the user out. Even if
    // this revocation failed, the user is still locked out: users are never
    // cached (plan §1), so every request re-reads the user and rejects
    // inactive accounts.
    await dependencies.sessionRevoker.revokeAllForUser(input.userId);
  };
}
