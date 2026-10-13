// Pure rule that decides whether a webhook POST really comes from Meta.
// `node:crypto` is allowed here because HMAC is a pure computation (plan §11).

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";
const HMAC_ALGORITHM = "sha256";

/**
 * Checks the `X-Hub-Signature-256` header Meta sends with every webhook POST:
 * it must be `sha256=` + HMAC-SHA256(raw body, app secret) in hex (FR-002, AC-1.3).
 * The raw body must be the exact text received, before any JSON parsing.
 * Comparison is timing-safe so attackers cannot guess the signature byte by byte.
 * See https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint
 */
export function hasValidWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (signatureHeader === null) {
    return false;
  }
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const receivedSignature = Buffer.from(signatureHeader.slice(SIGNATURE_PREFIX.length), "utf8");
  const expectedSignature = Buffer.from(computeSignature(rawBody, appSecret), "utf8");

  // `timingSafeEqual` throws when lengths differ, so check them first.
  if (receivedSignature.length !== expectedSignature.length) {
    return false;
  }
  return timingSafeEqual(receivedSignature, expectedSignature);
}

function computeSignature(rawBody: string, appSecret: string): string {
  return createHmac(HMAC_ALGORITHM, appSecret).update(rawBody, "utf8").digest("hex");
}
