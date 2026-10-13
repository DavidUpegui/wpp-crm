import { describe, expect, it } from "vitest";

import {
  ConversationNotFoundError,
  EmptyReplyTextError,
  OutsideCustomerServiceWindowError,
  ReplyTextTooLongError,
} from "@/modules/conversations/domain/errors";
import { MAX_REPLY_TEXT_LENGTH } from "@/modules/conversations/domain/reply-text";

import { makeSendTextReply } from "./send-text-reply";
import { FakeMessageSender } from "./testing/fake-message-sender";
import { InMemoryConversationStore } from "./testing/in-memory-conversation-store";
import { RecordingInboxEventPublisher } from "./testing/recording-inbox-event-publisher";

const FIXED_NOW = new Date("2026-05-01T12:00:00.000Z");
const ONE_HOUR_AGO = new Date("2026-05-01T11:00:00.000Z");
const TWENTY_FIVE_HOURS_AGO = new Date("2026-04-30T11:00:00.000Z");
const CUSTOMER_WA_ID = "5491100000001";
const SENDER_USER_ID = "user-ana";
const SENDER_NAME = "Ana Agente";

/** Seeds one contact whose conversation last heard from the customer at `lastInboundAt`. */
async function setUp(lastInboundAt: Date | null = ONE_HOUR_AGO) {
  const store = new InMemoryConversationStore({ now: () => FIXED_NOW });
  const messageSender = new FakeMessageSender();
  const inboxEventPublisher = new RecordingInboxEventPublisher();

  const contact = await store.contacts.upsertByWaId({
    waId: CUSTOMER_WA_ID,
    profileName: "Carla",
    profileNameSearch: "carla",
  });
  const conversation = await store.conversations.findOrCreateForContact(contact.id, ONE_HOUR_AGO);
  await store.conversations.update({ ...conversation, lastInboundAt });

  const sendTextReply = makeSendTextReply({
    transactionRunner: store,
    messageSender,
    inboxEventPublisher,
    now: () => FIXED_NOW,
  });
  return { store, messageSender, inboxEventPublisher, conversation, sendTextReply };
}

describe("sendTextReply", () => {
  it("stores the reply as queued, then marks it sent with Meta's wamid and the sender's user id", async () => {
    // Arrange
    const { store, messageSender, inboxEventPublisher, conversation, sendTextReply } = await setUp();

    // Act
    const reply = await sendTextReply({
      conversationId: conversation.id,
      text: "  Hola Carla  ",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    expect(messageSender.sentMessages).toEqual([{ toWaId: CUSTOMER_WA_ID, text: "Hola Carla" }]);
    expect(store.allMessages()).toEqual([
      {
        id: reply.id,
        conversationId: conversation.id,
        direction: "outbound",
        waMessageId: "wamid.fake-1",
        type: "text",
        text: "Hola Carla",
        sentAt: FIXED_NOW,
        status: "sent",
        failureReason: null,
        sentByUserId: SENDER_USER_ID,
      },
    ]);
    expect(reply).toEqual({
      id: reply.id,
      direction: "outbound",
      type: "text",
      text: "Hola Carla",
      sentAt: FIXED_NOW,
      status: "sent",
      failureReason: null,
      senderName: SENDER_NAME,
    });
    expect(inboxEventPublisher.events).toEqual([
      { type: "conversation_updated", conversationId: conversation.id },
      { type: "conversation_updated", conversationId: conversation.id },
    ]);
  });

  it("moves the conversation's latest activity and preview to the reply", async () => {
    // Arrange
    const { store, conversation, sendTextReply } = await setUp();

    // Act
    const reply = await sendTextReply({
      conversationId: conversation.id,
      text: "Hola",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    const storedConversation = await store.conversations.findById(conversation.id);
    expect(storedConversation?.lastActivityAt).toEqual(FIXED_NOW);
    expect(storedConversation?.lastMessageId).toBe(reply.id);
  });

  it("publishes the queued state before calling Meta", async () => {
    // Arrange
    const { store, messageSender, inboxEventPublisher, conversation } = await setUp();
    const statusesSeenByEvents: (string | null)[] = [];
    const observingPublisher = {
      async publish(): Promise<void> {
        statusesSeenByEvents.push(store.allMessages()[0]?.status ?? null);
      },
    };
    const sendTextReply = makeSendTextReply({
      transactionRunner: store,
      messageSender,
      inboxEventPublisher: observingPublisher,
      now: () => FIXED_NOW,
    });

    // Act
    await sendTextReply({
      conversationId: conversation.id,
      text: "Hola",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    expect(statusesSeenByEvents).toEqual(["queued", "sent"]);
    expect(inboxEventPublisher.events).toEqual([]);
  });

  it("rejects the reply when the 24h window is closed and does not call Meta", async () => {
    // Arrange
    const { store, messageSender, inboxEventPublisher, conversation, sendTextReply } =
      await setUp(TWENTY_FIVE_HOURS_AGO);

    // Act
    const sending = sendTextReply({
      conversationId: conversation.id,
      text: "Hola",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    await expect(sending).rejects.toBeInstanceOf(OutsideCustomerServiceWindowError);
    expect(messageSender.sentMessages).toEqual([]);
    expect(store.allMessages()).toEqual([]);
    expect(inboxEventPublisher.events).toEqual([]);
  });

  it("rejects the reply when the customer never wrote", async () => {
    // Arrange
    const { messageSender, conversation, sendTextReply } = await setUp(null);

    // Act
    const sending = sendTextReply({
      conversationId: conversation.id,
      text: "Hola",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    await expect(sending).rejects.toBeInstanceOf(OutsideCustomerServiceWindowError);
    expect(messageSender.sentMessages).toEqual([]);
  });

  it("rejects an empty reply and stores nothing", async () => {
    // Arrange
    const { store, messageSender, inboxEventPublisher, conversation, sendTextReply } = await setUp();

    // Act
    const sending = sendTextReply({
      conversationId: conversation.id,
      text: "   ",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    await expect(sending).rejects.toBeInstanceOf(EmptyReplyTextError);
    expect(store.allMessages()).toEqual([]);
    expect(messageSender.sentMessages).toEqual([]);
    expect(inboxEventPublisher.events).toEqual([]);
  });

  it("rejects a reply longer than WhatsApp allows and stores nothing", async () => {
    // Arrange
    const { store, messageSender, conversation, sendTextReply } = await setUp();

    // Act
    const sending = sendTextReply({
      conversationId: conversation.id,
      text: "a".repeat(MAX_REPLY_TEXT_LENGTH + 1),
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    await expect(sending).rejects.toBeInstanceOf(ReplyTextTooLongError);
    expect(store.allMessages()).toEqual([]);
    expect(messageSender.sentMessages).toEqual([]);
  });

  it.each([
    { metaErrorCode: 131030, expectedReason: "recipient_not_allowed" },
    { metaErrorCode: 131047, expectedReason: "outside_window" },
    { metaErrorCode: 190, expectedReason: "access_token_invalid" },
    { metaErrorCode: null, expectedReason: "unknown" },
  ])(
    "returns the reply as failed with reason $expectedReason when Meta fails with $metaErrorCode",
    async ({ metaErrorCode, expectedReason }) => {
      // Arrange
      const { store, inboxEventPublisher, messageSender, conversation, sendTextReply } =
        await setUp();
      messageSender.failWith(metaErrorCode);

      // Act
      const reply = await sendTextReply({
        conversationId: conversation.id,
        text: "Hola",
        senderUserId: SENDER_USER_ID,
        senderName: SENDER_NAME,
      });

      // Assert
      expect(reply.status).toBe("failed");
      expect(reply.failureReason).toBe(expectedReason);
      const [storedMessage] = store.allMessages();
      expect(storedMessage?.status).toBe("failed");
      expect(storedMessage?.failureReason).toBe(expectedReason);
      expect(storedMessage?.waMessageId).toBeNull();
      expect(inboxEventPublisher.events).toHaveLength(2);
    },
  );

  it("marks the reply failed with an unknown reason when the sender throws an unexpected error", async () => {
    // Arrange
    const { store, conversation } = await setUp();
    const brokenSender = {
      async sendText(): Promise<never> {
        throw new Error("network down");
      },
    };
    const sendTextReply = makeSendTextReply({
      transactionRunner: store,
      messageSender: brokenSender,
      inboxEventPublisher: new RecordingInboxEventPublisher(),
      now: () => FIXED_NOW,
    });

    // Act
    const reply = await sendTextReply({
      conversationId: conversation.id,
      text: "Hola",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    expect(reply.status).toBe("failed");
    expect(reply.failureReason).toBe("unknown");
  });

  it("fails with ConversationNotFoundError for an unknown conversation", async () => {
    // Arrange
    const { store, messageSender, sendTextReply } = await setUp();

    // Act
    const sending = sendTextReply({
      conversationId: "conversation-unknown",
      text: "Hola",
      senderUserId: SENDER_USER_ID,
      senderName: SENDER_NAME,
    });

    // Assert
    await expect(sending).rejects.toBeInstanceOf(ConversationNotFoundError);
    expect(messageSender.sentMessages).toEqual([]);
    expect(store.allMessages()).toEqual([]);
  });
});
