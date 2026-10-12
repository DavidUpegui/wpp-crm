import type { Actor } from "@/modules/users/domain/actor";
import { assertAdminCanChangeRole } from "@/modules/users/domain/admin-protections";
import { UserNotFoundError } from "@/modules/users/domain/errors";
import { assertIsAdmin } from "@/modules/users/domain/permissions";
import type { User, UserRole } from "@/modules/users/domain/user";
import type { UserTransactionRunner } from "@/modules/users/domain/user-transaction-runner";

/**
 * What the admin submits on the "edit user" form (US-8).
 *
 * There is deliberately NO `email` field: a user's email cannot be changed
 * after creation (BR-010), so the form shows it read-only (AC-8.5) and this
 * use case has no way to change it.
 */
export type UpdateUserInput = {
  /** The logged-in user making the change; must be an admin (BR-012). */
  actor: Actor;
  /** The id of the user being edited. */
  userId: string;
  name: string;
  role: UserRole;
};

/** The interfaces `updateUser` needs; the container passes the real ones, tests pass fakes. */
export type UpdateUserDependencies = {
  transactionRunner: UserTransactionRunner;
};

/**
 * Builds the use case that lets an admin change a user's name and role
 * (FR-015, AC-8.1).
 *
 * The actor must be an admin (BR-012, otherwise `ForbiddenError`). An admin
 * may rename themselves but not change their own role (BR-009, AC-8.3,
 * `CannotModifyOwnAccountError`), and nobody may demote the last active
 * admin (BR-008, AC-8.4, `LastActiveAdminError`). An unknown user fails
 * with `UserNotFoundError`. The new role applies on the user's next request
 * (BR-007), because sessions read the user fresh every time.
 *
 * Lock, check and update all happen in one transaction, so a rejected change
 * leaves nothing changed.
 */
export function makeUpdateUser(dependencies: UpdateUserDependencies) {
  return async function updateUser(input: UpdateUserInput): Promise<User> {
    assertIsAdmin(input.actor);

    return dependencies.transactionRunner.run(async ({ users }) => {
      // Lock the active admins FIRST, before reading the target. If two admins
      // demote each other at the same time, the second transaction waits here
      // until the first one commits, and then sees the new count. Reading the
      // target first could let both pass the BR-008 check with stale data.
      const activeAdminCount = await users.lockActiveAdmins();

      const target = await users.findById(input.userId);
      if (!target) {
        throw new UserNotFoundError();
      }

      assertAdminCanChangeRole({
        actorId: input.actor.id,
        target,
        newRole: input.role,
        activeAdminCount,
      });

      return users.updateNameAndRole(input.userId, { name: input.name.trim(), role: input.role });
    });
  };
}
