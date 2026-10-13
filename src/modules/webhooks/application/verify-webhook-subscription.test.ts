import { describe, expect, it } from "vitest";

import { WebhookVerificationFailedError } from "@/modules/webhooks/domain/errors";

import { makeVerifyWebhookSubscription } from "./verify-webhook-subscription";

const VERIFY_TOKEN = "expected-verify-token";
const CHALLENGE = "1158201444";

describe("verifyWebhookSubscription", () => {
  const verifyWebhookSubscription = makeVerifyWebhookSubscription({ verifyToken: VERIFY_TOKEN });

  it("returns the challenge when mode is subscribe and the token matches", async () => {
    const challenge = await verifyWebhookSubscription({
      mode: "subscribe",
      verifyToken: VERIFY_TOKEN,
      challenge: CHALLENGE,
    });

    expect(challenge).toBe(CHALLENGE);
  });

  it("throws WebhookVerificationFailedError when the token is wrong", async () => {
    const promise = verifyWebhookSubscription({
      mode: "subscribe",
      verifyToken: "wrong-token",
      challenge: CHALLENGE,
    });

    await expect(promise).rejects.toBeInstanceOf(WebhookVerificationFailedError);
  });

  it("throws WebhookVerificationFailedError when the mode is not subscribe", async () => {
    const promise = verifyWebhookSubscription({
      mode: null,
      verifyToken: VERIFY_TOKEN,
      challenge: CHALLENGE,
    });

    await expect(promise).rejects.toBeInstanceOf(WebhookVerificationFailedError);
  });
});
