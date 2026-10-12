// Type-only module: it describes the Drizzle database WITHOUT creating it.
//
// Why it exists: repositories receive the database in their constructor (dependency
// injection) instead of importing `@/shared/db/client`. The client reads `env.ts`, which
// requires every environment variable, so importing it would break integration tests and
// scripts that only have `DATABASE_URL`. This file must never import `env` or `client`.

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "./schema";

/** The node-postgres Drizzle database, typed with our schema. */
export type Database = NodePgDatabase<typeof schema>;

/** A transaction opened with `database.transaction(...)`. */
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Anything that can run queries: the database itself or an open transaction.
 * Repositories accept this so the same class works inside and outside a transaction.
 */
export type DatabaseExecutor = Database | DatabaseTransaction;
