import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const INTEGRATION_TEST_PATTERN = "**/*.integration.test.ts";

/**
 * Module aliases shared by the unit config (this file) and `vitest.integration.config.mts`,
 * so both test runs resolve imports exactly like the app does.
 */
export const sharedAliases: Record<string, string> = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` throws outside a React Server environment; stub it in tests.
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

/** Unit tests only: fast, no database. Integration tests run with `pnpm test:integration`. */
export default defineConfig({
  resolve: {
    alias: sharedAliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, INTEGRATION_TEST_PATTERN],
  },
});
