import { afterEach, describe, expect, it, vi } from "vitest";

const validEnv = {
  DATABASE_URL: "postgres://crm:crm@localhost:5432/wpp_crm",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  META_APP_ID: "123",
  META_APP_SECRET: "secret",
  META_GRAPH_API_VERSION: "v23.0",
  WHATSAPP_ACCESS_TOKEN: "token",
  WHATSAPP_PHONE_NUMBER_ID: "111",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "222",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-me",
};

async function loadEnv(vars: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return import("./env");
}

afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("parses a valid environment", async () => {
    const { env } = await loadEnv(validEnv);
    expect(env.META_GRAPH_API_VERSION).toBe("v23.0");
  });

  it("rejects a malformed Graph API version without leaking values", async () => {
    await expect(
      loadEnv({ ...validEnv, META_GRAPH_API_VERSION: "23", WHATSAPP_ACCESS_TOKEN: "super-secret" }),
    ).rejects.toThrow(/META_GRAPH_API_VERSION/);
    await expect(
      loadEnv({ ...validEnv, META_GRAPH_API_VERSION: "23", WHATSAPP_ACCESS_TOKEN: "super-secret" }),
    ).rejects.not.toThrow(/super-secret/);
  });
});
