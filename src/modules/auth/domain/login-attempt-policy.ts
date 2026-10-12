// Rule that limits failed logins (BR-004, AC-1.5).
//
// These functions are pure: they only look at the values they receive.
// The caller (the log-in use case) counts failures per email + IP address
// in the repository; this file only decides what those numbers mean.

/** Failed logins allowed for the same email + IP inside the window before blocking (BR-004). */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** How far back failed logins are counted (BR-004): 15 minutes. */
export const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Returns true when a new login attempt must be rejected because there were
 * already `MAX_FAILED_LOGIN_ATTEMPTS` failures in the window (BR-004).
 *
 * After 5 failures the 6th attempt is rejected, even with the correct
 * password (AC-1.5). `recentFailedAttempts` must be counted by the caller
 * for the same email + IP since `getFailedLoginWindowStart(now)`.
 */
export function isLoginBlocked(recentFailedAttempts: number): boolean {
  return recentFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
}

/**
 * Returns the moment the failure window starts: `now` minus 15 minutes.
 *
 * Why: the use case asks the repository for "failures since this date".
 * `now` is a parameter (never `new Date()` here) so the rule stays pure
 * and easy to test.
 */
export function getFailedLoginWindowStart(now: Date): Date {
  return new Date(now.getTime() - FAILED_LOGIN_WINDOW_MS);
}
