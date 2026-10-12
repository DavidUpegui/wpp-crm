import type { Actor } from "@/modules/users/domain/actor";
import { assertIsAdmin } from "@/modules/users/domain/permissions";
import type { User, UserListFilters } from "@/modules/users/domain/user";
import type { UserRepository } from "@/modules/users/domain/user-repository";

/** What the admin asks for on the "Usuarios" screen (US-6). */
export type ListUsersInput = {
  /** The logged-in user asking for the list; must be an admin (BR-012). */
  actor: Actor;
  /** Search text plus role and status filters; all optional and combined (AC-6.2, AC-6.3). */
  filters: UserListFilters;
};

/** The interfaces `listUsers` needs; the container passes the real ones, tests pass fakes. */
export type ListUsersDependencies = {
  userRepository: UserRepository;
};

/**
 * Builds the use case that lets an admin see and find users (FR-013,
 * AC-6.1). Only reads, so it needs no transaction.
 *
 * The actor must be an admin (BR-012, otherwise `ForbiddenError`). The
 * search matches name or email ignoring case (AC-6.2) and combines with the
 * role and status filters (AC-6.3). Users come back ordered by name; when
 * nothing matches the list is simply empty, and the screen shows its empty
 * state (AC-6.4).
 */
export function makeListUsers(dependencies: ListUsersDependencies) {
  return async function listUsers(input: ListUsersInput): Promise<User[]> {
    assertIsAdmin(input.actor);
    return dependencies.userRepository.list(cleanFilters(input.filters));
  };
}

/**
 * Trims the search text and drops it when nothing is left.
 *
 * Why: a search box that only contains spaces should show everyone, not
 * only the users whose name happens to contain those spaces.
 */
function cleanFilters(filters: UserListFilters): UserListFilters {
  const trimmedSearch = filters.search?.trim();
  if (!trimmedSearch) {
    return { ...filters, search: undefined };
  }
  return { ...filters, search: trimmedSearch };
}
