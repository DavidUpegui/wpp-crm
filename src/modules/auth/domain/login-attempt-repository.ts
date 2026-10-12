/**
 * Failed logins are counted per email + IP address together (BR-004), so
 * one attacker cannot lock a user out from every network.
 */
export type LoginAttemptKey = {
  /** Must already be normalized with `normalizeEmail` (BR-001). */
  email: string;
  ipAddress: string;
};

/**
 * Stores failed login attempts so the log-in use case can block repeated
 * guessing (BR-004, AC-1.5). This interface only stores and counts; what
 * the numbers mean is decided in `login-attempt-policy.ts`.
 */
export interface LoginAttemptRepository {
  /** Counts failures for this email + IP at or after `since` (see `getFailedLoginWindowStart`). */
  countRecentFailures(key: LoginAttemptKey, since: Date): Promise<number>;

  /** Saves one failed login for this email + IP. */
  recordFailure(key: LoginAttemptKey, attemptedAt: Date): Promise<void>;

  /** Deletes every failure for this email + IP, after a successful login. */
  clearFailures(key: LoginAttemptKey): Promise<void>;
}
