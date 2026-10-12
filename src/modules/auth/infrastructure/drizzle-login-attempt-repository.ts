import "server-only";

import { and, eq, gte, sql, type SQL } from "drizzle-orm";

import type { LoginAttemptKey, LoginAttemptRepository } from "@/modules/auth/domain/login-attempt-repository";
import type { DatabaseExecutor } from "@/shared/db/database";
import { loginAttempt as loginAttemptTable } from "@/shared/db/schema";

/**
 * `LoginAttemptRepository` backed by the `login_attempt` table (Drizzle + Postgres).
 * Failures are always counted and cleared per email + IP address together (BR-004).
 * It receives the database (or a transaction) in the constructor so it never imports
 * the global client.
 */
export class DrizzleLoginAttemptRepository implements LoginAttemptRepository {
  protected readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async countRecentFailures(key: LoginAttemptKey, since: Date): Promise<number> {
    const rows = await this.database
      // Postgres returns count(*) as a bigint, which node-postgres gives us as a string.
      .select({ failureCount: sql<string>`count(*)` })
      .from(loginAttemptTable)
      .where(and(matchesKey(key), gte(loginAttemptTable.attemptedAt, since)));

    // Convert explicitly: the count of failures for one email + IP always fits in a number.
    return Number(rows[0]?.failureCount ?? 0);
  }

  async recordFailure(key: LoginAttemptKey, attemptedAt: Date): Promise<void> {
    await this.database.insert(loginAttemptTable).values({
      email: key.email,
      ipAddress: key.ipAddress,
      attemptedAt,
    });
  }

  async clearFailures(key: LoginAttemptKey): Promise<void> {
    await this.database.delete(loginAttemptTable).where(matchesKey(key));
  }
}

/** Rows for exactly this email AND this IP address: other pairs are never touched (BR-004). */
function matchesKey(key: LoginAttemptKey): SQL | undefined {
  return and(eq(loginAttemptTable.email, key.email), eq(loginAttemptTable.ipAddress, key.ipAddress));
}
