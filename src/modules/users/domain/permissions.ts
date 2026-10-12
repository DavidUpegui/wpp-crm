import { ForbiddenError } from "./errors";
import type { User } from "./user";

/**
 * True when the user is an admin.
 *
 * Why a helper: the same check is needed as a boolean (for example to show
 * or hide the user management link) and as a guard (`assertIsAdmin`).
 */
export function isAdmin(user: Pick<User, "role">): boolean {
  return user.role === "admin";
}

/**
 * Throws `ForbiddenError` unless the user is an admin (BR-012).
 *
 * Why: only admins can see and use user management, so every user
 * management use case calls this first with the acting user.
 */
export function assertIsAdmin(user: Pick<User, "role">): void {
  if (!isAdmin(user)) {
    throw new ForbiddenError();
  }
}
