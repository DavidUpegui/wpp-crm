import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { InvalidWebhookSignatureError } from "@/modules/webhooks/domain/errors";

import { makeReceiveWebhook } from "./receive-webhook";
import { InMemoryWebhookEventRepository } from "./testing/in-memory-webhook-event-repository";

const APP_SECRET = "test-app-secret";
const RAW_BODY = '{"object":"whatsapp_business_account","entry":[]}';

function signatureFor(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex")}`;
}

function setUp(processWebhookPayload: (payload: unknown) => Promise<void> = async () => {}) {
  const webhookEventRepository = new InMemoryWebhookEventRepository();
  const processedPayloads: unknown[] = [];
  const receiveWebhook = makeReceiveWebhook({
    webhookEventRepository,
    appSecret: APP_SECRET,
    processWebhookPayload: async (payload) => {
      processedPayloads.push(payload);
      await processWebhookPayload(payload);
    },
  });
  return { receiveWebhook, webhookEventRepository, processedPayloads };
}

describe("receiveWebhook", () => {
  it("stores a POST with an invalid signature as invalid, does not process it, and throws", async () => {
    const { receiveWebhook, webhookEventRepository, processedPayloads } = setUp();

    const promise = receiveWebhook({ rawBody: RAW_BODY, signatureHeader: "sha256=wrong" });

    await expect(promise).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
    expect(webhookEventRepository.events).toMatchObject([
      { rawBody: RAW_BODY, signatureValid: false, processed: false },
    ]);
    expect(processedPayloads).toEqual([]);
  });

  it("stores a POST without a signature header as invalid and throws", async () => {
    const { receiveWebhook, webhookEventRepository, processedPayloads } = setUp();

    const promise = receiveWebhook({ rawBody: RAW_BODY, signatureHeader: null });

    await expect(promise).rejects.toBeInstanceOf(InvalidWebhookSignatureError);
    expect(webhookEventRepository.events).toMatchObject([{ signatureValid: false }]);
    expect(processedPayloads).toEqual([]);
  });

  it("stores, processes and marks as processed a POST with a valid signature", async () => {
    const { receiveWebhook, webhookEventRepository, processedPayloads } = setUp();

    await receiveWebhook({ rawBody: RAW_BODY, signatureHeader: signatureFor(RAW_BODY) });

    expect(processedPayloads).toEqual([JSON.parse(RAW_BODY)]);
    expect(webhookEventRepository.events).toMatchObject([
      { rawBody: RAW_BODY, signatureValid: true, processed: true, errorDescription: null },
    ]);
  });

  it("marks the event as failed and does not throw when processing fails", async () => {
    const { receiveWebhook, webhookEventRepository } = setUp(async () => {
      throw new TypeError("handler exploded");
    });

    await receiveWebhook({ rawBody: RAW_BODY, signatureHeader: signatureFor(RAW_BODY) });

    expect(webhookEventRepository.events).toMatchObject([
      { signatureValid: true, processed: false, errorDescription: "TypeError: handler exploded" },
    ]);
  });

  it("marks the event as failed and does not throw when a signed body is not JSON", async () => {
    const notJson = "this is not json";
    const { receiveWebhook, webhookEventRepository, processedPayloads } = setUp();

    await receiveWebhook({ rawBody: notJson, signatureHeader: signatureFor(notJson) });

    expect(processedPayloads).toEqual([]);
    expect(webhookEventRepository.events).toHaveLength(1);
    expect(webhookEventRepository.events[0]).toMatchObject({ signatureValid: true, processed: false });
    expect(webhookEventRepository.events[0].errorDescription).toMatch(/^SyntaxError: /);
  });
});
