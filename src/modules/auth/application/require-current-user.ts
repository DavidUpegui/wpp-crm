import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { PasswordChangeRequiredError, UnauthenticatedError } from "@/modules/auth/domain/errors";
import { ForbiddenError } from "@/modules/users/domain/errors";
import { isAdmin } from "@/modules/users/domain/permissions";
import type { GetCurrentUser } from "./get-current-user";

/** What the caller requires from the current user. */
export type RequireCurrentUserOptions = {
  /** Set to "admin" for admin-only pages and actions (FR-007, BR-012). */
  role?: "admin";
  /**
   * True only for the change-password screen (and its action): the one
   * place a user with a temporary password may go (BR-011). Default false.
   */
  allowPendingPasswordChange?: boolean;
};

/** The use cases `requireCurrentUser` needs; the container passes the real one, tests may pass a stub. */
export type RequireCurrentUserDependencies = {
  getCurrentUser: GetCurrentUser;
};

/**
 * Builds the guard that every protected page, action and route calls first.
 * It returns the current user or throws a typed error (FR-006, FR-007, FR-010):
 *
 * - `UnauthenticatedError` when there is no logged-in, active user (AC-3.4).
 * - `PasswordChangeRequiredError` when the user still has a temporary
 *   password, unless `allowPendingPasswordChange` is true (BR-011, AC-4.1).
 * - `ForbiddenError` when an admin is required and the user is not one
 *   (AC-3.5, BR-012).
 */
export function makeRequireCurrentUser(dependencies: RequireCurrentUserDependencies) {
  const { getCurrentUser } = dependencies;

  return async function requireCurrentUser(
    requestHeaders: Headers,
    options: RequireCurrentUserOptions = {},
  ): Promise<CurrentUser> {
    const allowPendingPasswordChange = options.allowPendingPasswordChange ?? false;

    // 1) No user at all (AC-3.4).
    const user = await getCurrentUser(requestHeaders);
    if (!user) {
      throw new UnauthenticatedError();
    }

    // 2) Temporary password (BR-011). Checked BEFORE the role: a user with a
    //    temporary password may do nothing else, so even an agent asking for
    //    an admin page must be sent to change the password first (AC-4.1).
    if (user.mustChangePassword && !allowPendingPasswordChange) {
      throw new PasswordChangeRequiredError();
    }

    // 3) Admin-only check (AC-3.5, BR-012).
    if (options.role === "admin" && !isAdmin(user)) {
      throw new ForbiddenError();
    }

    return user;
  };
}
