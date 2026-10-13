import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readInboundMessageContent } from "./inbound-message-content";
import {
  type MetaInboundMessage,
  metaMessagesChangeValueSchema,
  metaWebhookEnvelopeSchema,
} from "./meta-webhook-payload";

const FIXTURES_DIRECTORY = new URL("../../../../tests/fixtures/webhooks/", import.meta.url);

function firstMessageOf(fileName: string): MetaInboundMessage {
  const rawFixture: unknown = JSON.parse(
    readFileSync(new URL(fileName, FIXTURES_DIRECTORY), "utf8"),
  );
  const envelope = metaWebhookEnvelopeSchema.parse(rawFixture);
  const value = metaMessagesChangeValueSchema.parse(envelope.entry[0].changes[0].value);
  const message = value.messages?.[0];

  if (!message) {
    throw new Error(`Fixture ${fileName} has no inbound message`);
  }

  return message;
}

describe("readInboundMessageContent", () => {
  it("reads the body of a text message", () => {
    const content = readInboundMessageContent(firstMessageOf("text-message.json"));

    expect(content).toEqual({ type: "text", text: "Hola" });
  });

  it("keeps a text message without a body as text with no content", () => {
    const message: MetaInboundMessage = { id: "wamid.1", timestamp: "1700000000", type: "text" };

    expect(readInboundMessageContent(message)).toEqual({ type: "text", text: null });
  });

  it.each([
    ["image-message.json", "image"],
    ["reaction-message.json", "reaction"],
    ["unsupported-message.json", "unsupported"],
  ])("keeps the type of %s with no text", (fileName, expectedType) => {
    const content = readInboundMessageContent(firstMessageOf(fileName));

    expect(content).toEqual({ type: expectedType, text: null });
  });

  it("keeps an unknown message type with no text", () => {
    const message: MetaInboundMessage = { id: "wamid.2", timestamp: "1700000000", type: "sticker" };

    expect(readInboundMessageContent(message)).toEqual({ type: "sticker", text: null });
  });

  it("does not treat inherited object keys as readers", () => {
    const message: MetaInboundMessage = {
      id: "wamid.3",
      timestamp: "1700000000",
      type: "toString",
    };

    expect(readInboundMessageContent(message)).toEqual({ type: "toString", text: null });
  });
});
