/**
 * Vitest global setup for integration tests (`pnpm test:integration`).
 *
 * Why it exists: integration tests need a real Postgres database that is separate from the
 * dev database (`wpp_crm`), so tests can write and delete data freely. Before any test runs,
 * this setup makes sure the test database exists and has the latest schema:
 *
 * 1. Create the test database if it is missing. We do this here (instead of a docker init
 *    script) because init scripts only run when the Postgres volume is first created, and
 *    existing local volumes must not be deleted.
 * 2. Apply the Drizzle migrations from `./drizzle` to it (skipped while there are none).
 *
 * The URL is resolved once in `vitest.integration.config.mts` (`DATABASE_URL_TEST`, then
 * `.env.local`, then the default) and given to the test workers as `DATABASE_URL`.
 */
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

// Every Postgres server has this database; we connect to it to create the test database.
const MAINTENANCE_DATABASE_NAME = "postgres";
const MIGRATIONS_FOLDER = "./drizzle";
// Database names cannot be passed as query parameters, so only allow safe identifiers.
const SAFE_DATABASE_NAME_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const LOG_PREFIX = "[integration setup]";

/** Creates (if needed) and migrates the test database before the integration tests run. */
export default async function setup(project: TestProject): Promise<void> {
  const testDatabaseUrl = getTestDatabaseUrl(project);
  console.log(`${LOG_PREFIX} using test database ${redactPassword(testDatabaseUrl)}`);

  await createDatabaseIfMissing(testDatabaseUrl);
  await runMigrations(testDatabaseUrl);
}

/** The URL comes from `test.env.DATABASE_URL` in `vitest.integration.config.mts`. */
function getTestDatabaseUrl(project: TestProject): string {
  const testDatabaseUrl = project.config.env.DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error(`${LOG_PREFIX} test.env.DATABASE_URL is not set in vitest.integration.config.mts`);
  }

  return testDatabaseUrl;
}

async function createDatabaseIfMissing(testDatabaseUrl: string): Promise<void> {
  const databaseName = getSafeDatabaseName(testDatabaseUrl);
  const maintenanceClient = new Client({ connectionString: buildMaintenanceUrl(testDatabaseUrl) });
  await maintenanceClient.connect();

  try {
    const existing = await maintenanceClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      databaseName,
    ]);
    if (existing.rowCount !== null && existing.rowCount > 0) {
      return;
    }

    // Safe to interpolate: `getSafeDatabaseName` validated the name against a strict pattern.
    await maintenanceClient.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`${LOG_PREFIX} created database ${databaseName}`);
  } finally {
    await maintenanceClient.end();
  }
}

async function runMigrations(testDatabaseUrl: string): Promise<void> {
  if (!existsSync(MIGRATIONS_FOLDER)) {
    console.log(`${LOG_PREFIX} no migrations folder (${MIGRATIONS_FOLDER}) yet; skipping migrations`);
    return;
  }

  const testDatabaseClient = new Client({ connectionString: testDatabaseUrl });
  await testDatabaseClient.connect();

  try {
    await migrate(drizzle(testDatabaseClient), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log(`${LOG_PREFIX} migrations applied`);
  } finally {
    await testDatabaseClient.end();
  }
}

function getSafeDatabaseName(databaseUrl: string): string {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");

  if (!SAFE_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      `${LOG_PREFIX} invalid test database name "${databaseName}": use lowercase letters, digits and underscores`,
    );
  }

  return databaseName;
}

/** Same host and credentials, but pointing at the always-present `postgres` database. */
function buildMaintenanceUrl(databaseUrl: string): string {
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = `/${MAINTENANCE_DATABASE_NAME}`;
  return maintenanceUrl.toString();
}

function redactPassword(databaseUrl: string): string {
  const redactedUrl = new URL(databaseUrl);
  if (redactedUrl.password) {
    redactedUrl.password = "***";
  }
  return redactedUrl.toString();
}
