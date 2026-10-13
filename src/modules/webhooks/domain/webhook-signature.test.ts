import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hasValidWebhookSignature } from "./webhook-signature";

const APP_SECRET = "test-app-secret";
const RAW_BODY = '{"object":"whatsapp_business_account","entry":[]}';

function signatureFor(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("hasValidWebhookSignature", () => {
  it("accepts a header with the correct sha256 HMAC of the raw body", () => {
    const header = `sha256=${signatureFor(RAW_BODY, APP_SECRET)}`;

    expect(hasValidWebhookSignature(RAW_BODY, header, APP_SECRET)).toBe(true);
  });

  it("rejects a signature computed with a different secret", () => {
    const header = `sha256=${signatureFor(RAW_BODY, "other-secret")}`;

    expect(hasValidWebhookSignature(RAW_BODY, header, APP_SECRET)).toBe(false);
  });

  it("rejects a signature when the body was changed", () => {
    const header = `sha256=${signatureFor(RAW_BODY, APP_SECRET)}`;

    expect(hasValidWebhookSignature(`${RAW_BODY} `, header, APP_SECRET)).toBe(false);
  });

  it("rejects a request without the signature header", () => {
    expect(hasValidWebhookSignature(RAW_BODY, null, APP_SECRET)).toBe(false);
  });

  it("rejects a signature without the sha256= prefix", () => {
    const header = signatureFor(RAW_BODY, APP_SECRET);

    expect(hasValidWebhookSignature(RAW_BODY, header, APP_SECRET)).toBe(false);
  });

  it("rejects a signature of a different length without throwing", () => {
    const header = `sha256=${signatureFor(RAW_BODY, APP_SECRET).slice(0, 10)}`;

    expect(hasValidWebhookSignature(RAW_BODY, header, APP_SECRET)).toBe(false);
  });

  it("rejects an empty signature after the prefix", () => {
    expect(hasValidWebhookSignature(RAW_BODY, "sha256=", APP_SECRET)).toBe(false);
  });
});
