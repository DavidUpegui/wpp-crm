import { describe, expect, it } from "vitest";

import { InvalidWebhookPayloadError } from "@/modules/webhooks/domain/errors";
import type { WebhookChangeHandler } from "@/modules/webhooks/domain/webhook-change-handler";

import { makeProcessWebhookPayload } from "./process-webhook-payload";

type RecordingHandler = { handler: WebhookChangeHandler; receivedValues: unknown[] };

function makeRecordingHandler(): RecordingHandler {
  const receivedValues: unknown[] = [];
  return {
    receivedValues,
    handler: async (value: unknown): Promise<void> => {
      receivedValues.push(value);
    },
  };
}

function envelopeWith(changes: Array<{ field: string; value: unknown }>): unknown {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba-id", changes }],
  };
}

describe("processWebhookPayload", () => {
  it("dispatches each change to the handler registered for its field", async () => {
    const messages = makeRecordingHandler();
    const processWebhookPayload = makeProcessWebhookPayload({
      handlersByField: { messages: messages.handler },
    });
    const firstValue = { messages: [{ id: "wamid.1" }] };
    const secondValue = { statuses: [{ id: "wamid.2" }] };

    await processWebhookPayload(
      envelopeWith([
        { field: "messages", value: firstValue },
        { field: "messages", value: secondValue },
      ]),
    );

    expect(messages.receivedValues).toEqual([firstValue, secondValue]);
  });

  it("skips changes whose field has no handler", async () => {
    const messages = makeRecordingHandler();
    const processWebhookPayload = makeProcessWebhookPayload({
      handlersByField: { messages: messages.handler },
    });

    await processWebhookPayload(
      envelopeWith([{ field: "message_template_status_update", value: { event: "APPROVED" } }]),
    );

    expect(messages.receivedValues).toEqual([]);
  });

  it("throws InvalidWebhookPayloadError when the payload is not a Meta envelope", async () => {
    const processWebhookPayload = makeProcessWebhookPayload({ handlersByField: {} });

    await expect(processWebhookPayload({ object: "page", entry: [] })).rejects.toBeInstanceOf(
      InvalidWebhookPayloadError,
    );
    await expect(processWebhookPayload("not an object")).rejects.toBeInstanceOf(
      InvalidWebhookPayloadError,
    );
  });
});
