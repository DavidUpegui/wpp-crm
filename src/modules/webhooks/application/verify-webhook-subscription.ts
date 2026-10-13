import { WebhookVerificationFailedError } from "@/modules/webhooks/domain/errors";
import {
  getVerificationChallenge,
  type WebhookVerificationQuery,
} from "@/modules/webhooks/domain/webhook-verification";

/** What `verifyWebhookSubscription` needs; the container passes the configured token. */
export type VerifyWebhookSubscriptionDependencies = {
  /** Must match the "Verify token" saved in the Meta dashboard. */
  verifyToken: string;
};

/**
 * Builds the use case that answers Meta's subscription check (the GET sent
 * when the callback URL is saved). Returns the challenge to echo back, or
 * throws `WebhookVerificationFailedError` (403) when mode, token or challenge
 * are wrong (FR-001, AC-1.1, AC-1.2).
 */
export function makeVerifyWebhookSubscription(dependencies: VerifyWebhookSubscriptionDependencies) {
  return async function verifyWebhookSubscription(query: WebhookVerificationQuery): Promise<string> {
    const challenge = getVerificationChallenge(query, dependencies.verifyToken);
    if (challenge === null) {
      throw new WebhookVerificationFailedError();
    }
    return challenge;
  };
}
