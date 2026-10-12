import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { EmptyNameError } from "@/modules/users/domain/errors";
import type { UserRepository } from "@/modules/users/domain/user-repository";

/** What the "Mi cuenta" name form sends (US-5). */
export type UpdateOwnNameInput = {
  /** The logged-in user; only THEIR name is changed. */
  currentUser: CurrentUser;
  /** The new display name as typed; spaces around it are removed. */
  name: string;
};

/** The interfaces `updateOwnName` needs; the container passes the real ones, tests pass fakes. */
export type UpdateOwnNameDependencies = {
  userRepository: UserRepository;
};

/**
 * Builds the use case that lets a logged-in user change their own display
 * name in "Mi cuenta" (FR-011, AC-5.1).
 *
 * A user can only change their OWN name here. Email and role are read-only
 * in "Mi cuenta" (AC-5.4), which is why the input has no other fields.
 * The name is trimmed and must not be empty (otherwise `EmptyNameError`).
 * Nothing is returned: the page re-reads the user, so the new name shows
 * everywhere from the next page load (AC-5.1).
 */
export function makeUpdateOwnName(dependencies: UpdateOwnNameDependencies) {
  const { userRepository } = dependencies;

  return async function updateOwnName(input: UpdateOwnNameInput): Promise<void> {
    const name = input.name.trim();
    if (name === "") {
      throw new EmptyNameError();
    }

    await userRepository.updateName(input.currentUser.id, name);
  };
}
