import type { Authenticator } from "@/modules/auth/domain/authenticator";

/** The interfaces `logOut` needs; the container passes the real ones, tests pass fakes. */
export type LogOutDependencies = {
  authenticator: Authenticator;
};

/**
 * Builds the use case that ends the current session (FR-005, AC-2.1).
 *
 * It only delegates to the authenticator, which deletes the session and
 * clears the cookie. Redirecting to the login screen is the caller's job.
 * Logging out is always allowed, even with a temporary password (BR-011).
 */
export function makeLogOut(dependencies: LogOutDependencies) {
  const { authenticator } = dependencies;

  return async function logOut(requestHeaders: Headers): Promise<void> {
    await authenticator.signOut(requestHeaders);
  };
}
