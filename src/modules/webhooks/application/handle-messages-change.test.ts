import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { InboundMessageInput } from "@/modules/conversations/domain/inbound-message-input";
import type { MessageStatusReport } from "@/modules/conversations/domain/message-status-report";
import { MissingSenderWaIdError } from "@/modules/webhooks/domain/errors";
import { metaWebhookEnvelopeSchema } from "@/modules/webhooks/domain/meta-webhook-payload";
import type { WebhookChangeHandler } from "@/modules/webhooks/domain/webhook-change-handler";

import { makeHandleMessagesChange } from "./handle-messages-change";

const FIXTURES_DIRECTORY = new URL("../../../../tests/fixtures/webhooks/", import.meta.url);
const BUSINESS_PHONE_NUMBER_ID = "100000000000002";

type SpiedHandler = {
  handleMessagesChange: WebhookChangeHandler;
  recordedMessages: InboundMessageInput[];
  appliedStatuses: MessageStatusReport[];
};

function makeSpiedHandler(): SpiedHandler {
  const recordedMessages: InboundMessageInput[] = [];
  const appliedStatuses: MessageStatusReport[] = [];
  const handleMessagesChange = makeHandleMessagesChange({
    recordInboundMessage: async (input) => {
      recordedMessages.push(input);
    },
    applyMessageStatus: async (report) => {
      appliedStatuses.push(report);
    },
    businessPhoneNumberId: BUSINESS_PHONE_NUMBER_ID,
  });
  return { handleMessagesChange, recordedMessages, appliedStatuses };
}

function changeValueOf(fileName: string): Record<string, unknown> {
  const rawFixture: unknown = JSON.parse(
    readFileSync(new URL(fileName, FIXTURES_DIRECTORY), "utf8"),
  );
  const envelope = metaWebhookEnvelopeSchema.parse(rawFixture);
  return envelope.entry[0].changes[0].value as Record<string, unknown>;
}

describe("handleMessagesChange", () => {
  it("records an inbound text message with sender, profile name, text and send time", async () => {
    const spied = makeSpiedHandler();

    await spied.handleMessagesChange(changeValueOf("text-message.json"));

    expect(spied.recordedMessages).toEqual([
      {
        waMessageId: "wamid.FAKE_INBOUND_TEXT",
        fromWaId: "573001234567",
        profileName: "José Pérez",
        type: "text",
        text: "Hola",
        sentAt: new Date(1791856247000),
      },
    ]);
    expect(spied.appliedStatuses).toEqual([]);
  });

  it("records an image message without text", async () => {
    const spied = makeSpiedHandler();

    await spied.handleMessagesChange(changeValueOf("image-message.json"));

    expect(spied.recordedMessages).toHaveLength(1);
    expect(spied.recordedMessages[0]).toMatchObject({
      waMessageId: "wamid.FAKE_INBOUND_IMAGE",
      type: "image",
      text: null,
    });
  });

  it("records a reaction with its Meta type and no text", async () => {
    const spied = makeSpiedHandler();

    await spied.handleMessagesChange(changeValueOf("reaction-message.json"));

    expect(spied.recordedMessages[0]).toMatchObject({ type: "reaction", text: null });
  });

  it("applies a sent status without a failure code", async () => {
    const spied = makeSpiedHandler();

    await spied.handleMessagesChange(changeValueOf("status-sent.json"));

    expect(spied.appliedStatuses).toEqual([
      { waMessageId: "wamid.FAKE_OUTBOUND_REPLY", status: "sent", failureCode: null },
    ]);
    expect(spied.recordedMessages).toEqual([]);
  });

  it("applies delivered and read statuses", async () => {
    const spied = makeSpiedHandler();

    await spied.handleMessagesChange(changeValueOf("status-delivered.json"));
    await spied.handleMessagesChange(changeValueOf("status-read.json"));

    expect(spied.appliedStatuses.map((report) => report.status)).toEqual(["delivered", "read"]);
  });

  it("applies a failed status carrying Meta's error code", async () => {
    const spied = makeSpiedHandler();

    await spied.handleMessagesChange(changeValueOf("status-failed.json"));

    expect(spied.appliedStatuses).toEqual([
      { waMessageId: "wamid.FAKE_OUTBOUND_REPLY", status: "failed", failureCode: 131030 },
    ]);
  });

  it("ignores events for another business phone number", async () => {
    const spied = makeSpiedHandler();
    const value = changeValueOf("text-message.json");
    const otherPhoneValue = {
      ...value,
      metadata: { display_phone_number: "15559999999", phone_number_id: "999999999999999" },
    };

    await spied.handleMessagesChange(otherPhoneValue);

    expect(spied.recordedMessages).toEqual([]);
    expect(spied.appliedStatuses).toEqual([]);
  });

  it("takes the sender from the contacts list when the message has no from", async () => {
    const spied = makeSpiedHandler();
    const value = changeValueOf("text-message.json");
    const messages = value.messages as Array<Record<string, unknown>>;
    const messageWithoutFrom = { ...messages[0], from: undefined };

    await spied.handleMessagesChange({ ...value, messages: [messageWithoutFrom] });

    expect(spied.recordedMessages[0]).toMatchObject({
      fromWaId: "573001234567",
      profileName: "José Pérez",
    });
  });

  it("throws MissingSenderWaIdError when a message has no from and no contacts", async () => {
    const spied = makeSpiedHandler();
    const value = changeValueOf("text-message.json");
    const messages = value.messages as Array<Record<string, unknown>>;
    const messageWithoutFrom = { ...messages[0], from: undefined };

    await expect(
      spied.handleMessagesChange({ ...value, contacts: undefined, messages: [messageWithoutFrom] }),
    ).rejects.toBeInstanceOf(MissingSenderWaIdError);
    expect(spied.recordedMessages).toEqual([]);
  });

  it("throws when the value is not a valid messages change", async () => {
    const spied = makeSpiedHandler();

    await expect(spied.handleMessagesChange({ messaging_product: "whatsapp" })).rejects.toThrow();
  });
});
