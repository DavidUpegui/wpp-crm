import { describe, expect, it } from "vitest";

import type { Conversation } from "@/modules/conversations/domain/conversation";
import type { ConversationRepository } from "@/modules/conversations/domain/conversation-repository";
import { ConversationNotFoundError } from "@/modules/conversations/domain/errors";

import { makeMarkConversationRead } from "./mark-conversation-read";
import { InMemoryConversationStore } from "./testing/in-memory-conversation-store";
import { RecordingInboxEventPublisher } from "./testing/recording-inbox-event-publisher";

const NOW = new Date("2026-10-12T10:00:00Z");

/** Builds the use case over an in-memory store with one conversation that has `unreadCount` unread messages. */
async function setUp(unreadCount: number) {
  const store = new InMemoryConversationStore();
  const created = await store.conversations.findOrCreateForContact("contact-1", NOW);
  const conversation: Conversation = { ...created, unreadCount };
  await store.conversations.update(conversation);

  const conversationRepository = countingUpdates(store.conversations);
  const inboxEventPublisher = new RecordingInboxEventPublisher();
  const markConversationRead = makeMarkConversationRead({
    conversationRepository: conversationRepository.repository,
    inboxEventPublisher,
  });
  return { store, conversation, conversationRepository, inboxEventPublisher, markConversationRead };
}

/** Wraps a repository so the test can tell whether anything was written. */
function countingUpdates(inner: ConversationRepository) {
  const counter = { updateCount: 0 };
  const repository: ConversationRepository = {
    findById: (conversationId) => inner.findById(conversationId),
    findOrCreateForContact: (contactId, now) => inner.findOrCreateForContact(contactId, now),
    update: async (conversation: Conversation) => {
      counter.updateCount += 1;
      await inner.update(conversation);
    },
  };
  return { repository, counter };
}

describe("markConversationRead", () => {
  it("sets the unread count to zero and publishes one event", async () => {
    const { store, conversation, inboxEventPublisher, markConversationRead } = await setUp(3);

    await markConversationRead(conversation.id);

    expect(store.allConversations()[0].unreadCount).toBe(0);
    expect(inboxEventPublisher.events).toEqual([
      { type: "conversation_updated", conversationId: conversation.id },
    ]);
  });

  it("writes nothing and publishes nothing when the conversation is already read", async () => {
    const { conversation, conversationRepository, inboxEventPublisher, markConversationRead } =
      await setUp(0);

    await markConversationRead(conversation.id);

    expect(conversationRepository.counter.updateCount).toBe(0);
    expect(inboxEventPublisher.events).toEqual([]);
  });

  it("throws ConversationNotFoundError for an unknown conversation id", async () => {
    const { inboxEventPublisher, markConversationRead } = await setUp(2);

    await expect(markConversationRead("conversation-unknown")).rejects.toBeInstanceOf(
      ConversationNotFoundError,
    );
    expect(inboxEventPublisher.events).toEqual([]);
  });
});
