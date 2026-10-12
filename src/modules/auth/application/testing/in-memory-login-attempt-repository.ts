// TEST-ONLY fake. Never import this file from production code.

import type { LoginAttemptKey, LoginAttemptRepository } from "@/modules/auth/domain/login-attempt-repository";

/** One stored failed login. */
export type StoredLoginAttempt = {
  email: string;
  ipAddress: string;
  attemptedAt: Date;
};

/**
 * Keeps failed logins in memory so the log-in use case can be tested without
 * a database. Like the real repository, it counts and clears per email + IP
 * address together (BR-004).
 */
export class InMemoryLoginAttemptRepository implements LoginAttemptRepository {
  private attempts: StoredLoginAttempt[] = [];

  async countRecentFailures(key: LoginAttemptKey, since: Date): Promise<number> {
    let recentFailureCount = 0;
    for (const attempt of this.attempts) {
      if (matchesKey(attempt, key) && attempt.attemptedAt.getTime() >= since.getTime()) {
        recentFailureCount += 1;
      }
    }
    return recentFailureCount;
  }

  async recordFailure(key: LoginAttemptKey, attemptedAt: Date): Promise<void> {
    this.attempts.push({ email: key.email, ipAddress: key.ipAddress, attemptedAt: new Date(attemptedAt) });
  }

  async clearFailures(key: LoginAttemptKey): Promise<void> {
    this.attempts = this.attempts.filter((attempt) => !matchesKey(attempt, key));
  }

  /** Test helper: copies of every stored failed login, in the order they were recorded. */
  allAttempts(): StoredLoginAttempt[] {
    return this.attempts.map((attempt) => ({ ...attempt, attemptedAt: new Date(attempt.attemptedAt) }));
  }
}

function matchesKey(attempt: StoredLoginAttempt, key: LoginAttemptKey): boolean {
  return attempt.email === key.email && attempt.ipAddress === key.ipAddress;
}
