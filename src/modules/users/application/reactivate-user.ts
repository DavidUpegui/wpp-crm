import type { Actor } from "@/modules/users/domain/actor";
import { UserNotFoundError } from "@/modules/users/domain/errors";
import { assertIsAdmin } from "@/modules/users/domain/permissions";
import type { UserRepository } from "@/modules/users/domain/user-repository";

/** What the admin confirms in the "Reactivar" dialog (US-9). */
export type ReactivateUserInput = {
  /** The logged-in user making the change; must be an admin (BR-012). */
  actor: Actor;
  /** The id of the user being reactivated. */
  userId: string;
};

/** The interfaces `reactivateUser` needs; the container passes the real ones, tests pass fakes. */
export type ReactivateUserDependencies = {
  userRepository: UserRepository;
};

/**
 * Builds the use case that lets an admin reactivate a deactivated user
 * (FR-016, AC-9.2). Only the status changes: the password is untouched, so
 * the user logs in again with their existing password.
 *
 * The actor must be an admin (BR-012, otherwise `ForbiddenError`). An unknown
 * user fails with `UserNotFoundError`. No self or last-admin rules apply
 * (BR-008, BR-009): reactivating can only add active admins, never remove one,
 * so no transaction or lock is needed.
 */
export function makeReactivateUser(dependencies: ReactivateUserDependencies) {
  return async function reactivateUser(input: ReactivateUserInput): Promise<void> {
    assertIsAdmin(input.actor);

    const target = await dependencies.userRepository.findById(input.userId);
    if (!target) {
      throw new UserNotFoundError();
    }

    await dependencies.userRepository.setStatus(input.userId, "active");
  };
}
