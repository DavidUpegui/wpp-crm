// TEST-ONLY helper for integration tests. Never import this file from production code.
//
// It connects to the TEST database: `vitest.integration.config.mts` sets `DATABASE_URL`
// to `wpp_crm_test` inside every test worker. It does not use `@/shared/db/client`, because
// that module reads `env.ts`, which requires every environment variable.

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Database } from "@/shared/db/database";
import * as schema from "@/shared/db/schema";

/** A Drizzle database for one test file plus a way to close its connections. */
export type TestDatabase = {
  database: Database;
  /** Ends the connection pool; call it in `afterAll`. */
  close: () => Promise<void>;
};

/** Connects to the integration test database (`DATABASE_URL`, set by the integration config). */
export function createTestDatabase(): TestDatabase {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set: run integration tests with `pnpm test:integration`.");
  }

  const pool = new Pool({ connectionString });
  return {
    database: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}

/** Empties every authentication table, so each test starts from a clean database. */
export async function resetAuthTables(database: Database): Promise<void> {
  await database.execute(
    sql`TRUNCATE "user", "session", "account", "verification", "login_attempt" RESTART IDENTITY CASCADE`,
  );
}
