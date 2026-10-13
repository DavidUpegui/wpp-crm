// Pure rule for Meta's webhook subscription check (the GET request Meta sends
// when the callback URL is saved in the dashboard).

const SUBSCRIBE_MODE = "subscribe";

/** The `hub.*` query parameters Meta sends on the verification GET; each may be missing. */
export interface WebhookVerificationQuery {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}

/**
 * Returns the challenge to echo back when `hub.mode` is "subscribe" and
 * `hub.verify_token` matches our configured token; otherwise `null` (FR-001, AC-1.1, AC-1.2).
 * See https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint
 */
export function getVerificationChallenge(
  query: WebhookVerificationQuery,
  expectedVerifyToken: string,
): string | null {
  if (query.mode !== SUBSCRIBE_MODE) {
    return null;
  }
  if (query.verifyToken !== expectedVerifyToken) {
    return null;
  }
  if (query.challenge === null || query.challenge === "") {
    return null;
  }
  return query.challenge;
}
