import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";
import { sharedAliases } from "./vitest.config.mjs";

const ENV_FILE_PATH = ".env.local";
// Same value as documented in `.env.example`; matches docker-compose.yml.
const DEFAULT_TEST_DATABASE_URL = "postgres://crm:crm@localhost:5432/wpp_crm_test";

/**
 * Integration tests: run against the real Postgres test database (`wpp_crm_test`).
 * `tests/integration/global-setup.ts` creates and migrates that database before the tests run.
 */
export default defineConfig({
  resolve: {
    alias: sharedAliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts", "tests/**/*.integration.test.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    // All test files share one database, so run them one at a time to avoid interference.
    fileParallelism: false,
    // `test.env` is applied inside every test worker, so code under test that reads
    // `DATABASE_URL` connects to the test database and never to the dev database.
    // The global setup reads the same value (`project.config.env.DATABASE_URL`), so the URL
    // is resolved in exactly one place.
    env: {
      DATABASE_URL: resolveTestDatabaseUrl(),
    },
  },
});

/**
 * Returns `DATABASE_URL_TEST` from the environment, then from `.env.local`, then the
 * documented default. `.env.local` is read into a private object so its other values
 * (like the dev `DATABASE_URL`) never leak into `process.env`.
 */
function resolveTestDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) {
    return process.env.DATABASE_URL_TEST;
  }

  const valuesFromEnvFile: Record<string, string> = {};
  loadDotenv({ path: ENV_FILE_PATH, processEnv: valuesFromEnvFile, quiet: true });

  return valuesFromEnvFile.DATABASE_URL_TEST ?? DEFAULT_TEST_DATABASE_URL;
}
