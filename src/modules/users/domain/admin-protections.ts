// Rules that stop an admin from locking themselves (or everyone) out of user
// management (BR-008, BR-009).
//
// These functions are pure: they only look at the values they receive.
// They do NOT check that the actor is an admin — use cases call
// `assertIsAdmin` (permissions.ts) for that first.
//
// Concurrency (plan §5): `activeAdminCount` must be read inside the same
// database transaction that performs the change, after locking the active
// admins. Otherwise two admins demoting each other at the same time could
// both pass this check and leave no active admin.

import { CannotModifyOwnAccountError, LastActiveAdminError } from "./errors";
import type { User, UserRole } from "./user";

/** Fewest active admins the system may have at any time (BR-008). */
export const MINIMUM_ACTIVE_ADMINS = 1;

/** The fields of the target user these rules need. */
type ProtectedUser = Pick<User, "id" | "role" | "status">;

/**
 * Throws when an admin may not change `target`'s role to `newRole`;
 * returns normally otherwise.
 *
 * - Changing your own role → `CannotModifyOwnAccountError` (BR-009, AC-8.3).
 * - Demoting the last active admin to agent → `LastActiveAdminError` (BR-008, AC-8.4).
 *
 * Keeping the same role (for example, only the name changes) is always allowed.
 * Does not check that the actor is an admin (use `assertIsAdmin`).
 * `activeAdminCount` must come from the same transaction as the update.
 */
export function assertAdminCanChangeRole({
  actorId,
  target,
  newRole,
  activeAdminCount,
}: {
  actorId: string;
  target: ProtectedUser;
  newRole: UserRole;
  activeAdminCount: number;
}): void {
  const roleChanges = newRole !== target.role;
  if (!roleChanges) {
    return;
  }

  if (target.id === actorId) {
    throw new CannotModifyOwnAccountError();
  }

  const isDemotingAnAdmin = newRole === "agent";
  if (isDemotingAnAdmin && isLastActiveAdmin(target, activeAdminCount)) {
    throw new LastActiveAdminError();
  }
}

/**
 * Throws when an admin may not deactivate `target`; returns normally otherwise.
 *
 * - Deactivating yourself → `CannotModifyOwnAccountError` (BR-009, AC-9.3).
 * - Deactivating the last active admin → `LastActiveAdminError` (BR-008, AC-9.4).
 *
 * Does not check that the actor is an admin (use `assertIsAdmin`).
 * `activeAdminCount` must come from the same transaction as the update.
 */
export function assertAdminCanDeactivate({
  actorId,
  target,
  activeAdminCount,
}: {
  actorId: string;
  target: ProtectedUser;
  activeAdminCount: number;
}): void {
  if (target.id === actorId) {
    throw new CannotModifyOwnAccountError();
  }

  if (isLastActiveAdmin(target, activeAdminCount)) {
    throw new LastActiveAdminError();
  }
}

/**
 * Throws `CannotModifyOwnAccountError` when an admin tries to reset their own
 * password through user management (BR-009, AC-10.2); they use "Mi cuenta"
 * instead. Does not check that the actor is an admin (use `assertIsAdmin`).
 */
export function assertAdminCanResetPassword({
  actorId,
  target,
}: {
  actorId: string;
  target: ProtectedUser;
}): void {
  if (target.id === actorId) {
    throw new CannotModifyOwnAccountError();
  }
}

/**
 * True when `target` is an active admin and removing them would drop the
 * number of active admins below `MINIMUM_ACTIVE_ADMINS`.
 * An inactive admin is not counted, so it is never "the last active admin".
 */
function isLastActiveAdmin(target: ProtectedUser, activeAdminCount: number): boolean {
  const isActiveAdmin = target.role === "admin" && target.status === "active";
  return isActiveAdmin && activeAdminCount <= MINIMUM_ACTIVE_ADMINS;
}
