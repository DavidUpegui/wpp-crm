import { describe, expect, it, vi } from "vitest";

import type { InboundMessageInput } from "@/modules/conversations/domain/inbound-message-input";

import { makeRecordInboundMessage } from "./record-inbound-message";
import { InMemoryConversationStore } from "./testing/in-memory-conversation-store";
import { RecordingInboxEventPublisher } from "./testing/recording-inbox-event-publisher";

const NOW = new Date("2026-10-12T12:00:00.000Z");
const CUSTOMER_WA_ID = "573001234567";

function setUp(): {
  store: InMemoryConversationStore;
  publisher: RecordingInboxEventPublisher;
  recordInboundMessage: (input: InboundMessageInput) => Promise<void>;
} {
  const store = new InMemoryConversationStore({ now: () => NOW });
  const publisher = new RecordingInboxEventPublisher();
  const recordInboundMessage = makeRecordInboundMessage({
    transactionRunner: store,
    inboxEventPublisher: publisher,
    now: () => NOW,
  });
  return { store, publisher, recordInboundMessage };
}

function inboundMessage(overrides: Partial<InboundMessageInput> = {}): InboundMessageInput {
  return {
    waMessageId: "wamid.first",
    fromWaId: CUSTOMER_WA_ID,
    profileName: "José Pérez",
    type: "text",
    text: "Hola",
    sentAt: new Date("2026-10-12T11:59:00.000Z"),
    ...overrides,
  };
}

describe("recordInboundMessage", () => {
  it("creates the contact and conversation on the first message with one unread", async () => {
    const { store, recordInboundMessage } = setUp();
    const message = inboundMessage();

    await recordInboundMessage(message);

    expect(store.allContacts()).toEqual([
      expect.objectContaining({ waId: CUSTOMER_WA_ID, profileName: "José Pérez" }),
    ]);
    const [storedMessage] = store.allMessages();
    expect(store.allConversations()).toEqual([
      expect.objectContaining({
        unreadCount: 1,
        lastInboundAt: message.sentAt,
        lastActivityAt: message.sentAt,
        lastMessageId: storedMessage.id,
      }),
    ]);
    expect(storedMessage).toEqual(
      expect.objectContaining({ direction: "inbound", text: "Hola", waMessageId: "wamid.first" }),
    );
  });

  it("stores the profile name in searchable form", async () => {
    const { store, recordInboundMessage } = setUp();
    const upsertSpy = vi.spyOn(store.contacts, "upsertByWaId");

    await recordInboundMessage(inboundMessage());

    expect(upsertSpy).toHaveBeenCalledWith({
      waId: CUSTOMER_WA_ID,
      profileName: "José Pérez",
      profileNameSearch: "jose perez",
    });
  });

  it("reuses the contact and conversation for a second message and counts two unread", async () => {
    const { store, recordInboundMessage } = setUp();
    const secondSentAt = new Date("2026-10-12T12:01:00.000Z");

    await recordInboundMessage(inboundMessage());
    await recordInboundMessage(
      inboundMessage({ waMessageId: "wamid.second", text: "¿Siguen?", sentAt: secondSentAt }),
    );

    expect(store.allContacts()).toHaveLength(1);
    const conversations = store.allConversations();
    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toEqual(
      expect.objectContaining({
        unreadCount: 2,
        lastInboundAt: secondSentAt,
        lastActivityAt: secondSentAt,
        lastMessageId: store.allMessages()[1].id,
      }),
    );
  });

  it("updates the contact name when the profile name changes", async () => {
    const { store, recordInboundMessage } = setUp();

    await recordInboundMessage(inboundMessage());
    await recordInboundMessage(
      inboundMessage({ waMessageId: "wamid.second", profileName: "Pepe" }),
    );

    expect(store.allContacts()[0].profileName).toBe("Pepe");
  });

  it("ignores a duplicate delivery of the same message without publishing again", async () => {
    const { store, publisher, recordInboundMessage } = setUp();

    await recordInboundMessage(inboundMessage());
    await recordInboundMessage(inboundMessage());

    expect(store.allMessages()).toHaveLength(1);
    expect(store.allConversations()[0].unreadCount).toBe(1);
    expect(publisher.events).toHaveLength(1);
  });

  it("does not let an older late message replace the preview but still counts it unread", async () => {
    const { store, recordInboundMessage } = setUp();
    const newerSentAt = new Date("2026-10-12T11:59:00.000Z");
    const olderSentAt = new Date("2026-10-12T11:50:00.000Z");

    await recordInboundMessage(inboundMessage({ waMessageId: "wamid.newer", sentAt: newerSentAt }));
    const newerMessageId = store.allMessages()[0].id;
    await recordInboundMessage(inboundMessage({ waMessageId: "wamid.older", sentAt: olderSentAt }));

    expect(store.allConversations()[0]).toEqual(
      expect.objectContaining({
        unreadCount: 2,
        lastMessageId: newerMessageId,
        lastActivityAt: newerSentAt,
        lastInboundAt: newerSentAt,
      }),
    );
  });

  it("publishes one conversation_updated event per new message", async () => {
    const { store, publisher, recordInboundMessage } = setUp();

    await recordInboundMessage(inboundMessage());
    await recordInboundMessage(inboundMessage({ waMessageId: "wamid.second" }));

    const conversationId = store.allConversations()[0].id;
    expect(publisher.events).toEqual([
      { type: "conversation_updated", conversationId },
      { type: "conversation_updated", conversationId },
    ]);
  });
});
