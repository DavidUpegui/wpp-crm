// Proves the in-memory store honors the same contract as the Drizzle
// repositories (AGENTS.md §5.3 L), because every use case test relies on it.

import { describe, expect, it } from "vitest";

import { InMemoryConversationStore } from "./in-memory-conversation-store";

const FIXED_NOW = new Date("2026-05-01T12:00:00.000Z");
const CUSTOMER_WA_ID = "5491100000001";

class SimulatedFailureError extends Error {}

describe("InMemoryConversationStore", () => {
  it("creates a contact the first time a WhatsApp number is upserted", async () => {
    // Arrange
    const store = new InMemoryConversationStore({ now: () => FIXED_NOW });

    // Act
    const contact = await store.contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "Ana",
      profileNameSearch: "ana",
    });

    // Assert
    expect(contact).toEqual({
      id: "contact-1",
      waId: CUSTOMER_WA_ID,
      profileName: "Ana",
      createdAt: FIXED_NOW,
    });
  });

  it("updates the name of an existing contact instead of creating a second one", async () => {
    // Arrange
    const store = new InMemoryConversationStore();
    const first = await store.contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "Ana",
      profileNameSearch: "ana",
    });

    // Act
    const second = await store.contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "Ana Pérez",
      profileNameSearch: "ana perez",
    });

    // Assert
    expect(second.id).toBe(first.id);
    expect(second.profileName).toBe("Ana Pérez");
    expect(store.allContacts()).toHaveLength(1);
  });

  it("keeps the stored name when an upsert brings no name", async () => {
    // Arrange
    const store = new InMemoryConversationStore();
    await store.contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "Ana",
      profileNameSearch: "ana",
    });

    // Act
    const contact = await store.contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: null,
      profileNameSearch: null,
    });

    // Assert
    expect(contact.profileName).toBe("Ana");
  });

  it("finds a stored contact by id and returns null for an unknown id", async () => {
    // Arrange
    const store = new InMemoryConversationStore({ now: () => FIXED_NOW });
    const contact = await store.contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "Ana",
      profileNameSearch: "ana",
    });

    // Act
    const found = await store.contacts.findById(contact.id);
    const missing = await store.contacts.findById("contact-unknown");

    // Assert
    expect(found).toEqual(contact);
    expect(missing).toBeNull();
  });

  it("returns the same conversation when asked twice for the same contact", async () => {
    // Arrange
    const store = new InMemoryConversationStore();

    // Act
    const first = await store.conversations.findOrCreateForContact("contact-1", FIXED_NOW);
    const second = await store.conversations.findOrCreateForContact("contact-1", new Date());

    // Assert
    expect(first).toEqual({
      id: "conversation-1",
      contactId: "contact-1",
      lastInboundAt: null,
      lastActivityAt: FIXED_NOW,
      lastMessageId: null,
      unreadCount: 0,
    });
    expect(second.id).toBe(first.id);
    expect(store.allConversations()).toHaveLength(1);
  });

  it("saves conversation changes made with update", async () => {
    // Arrange
    const store = new InMemoryConversationStore();
    const conversation = await store.conversations.findOrCreateForContact("contact-1", FIXED_NOW);

    // Act
    await store.conversations.update({ ...conversation, unreadCount: 3, lastInboundAt: FIXED_NOW });

    // Assert
    const stored = await store.conversations.findById(conversation.id);
    expect(stored?.unreadCount).toBe(3);
    expect(stored?.lastInboundAt).toEqual(FIXED_NOW);
  });

  it("returns null when inserting an inbound message whose waMessageId already exists", async () => {
    // Arrange
    const store = new InMemoryConversationStore();
    const inboundMessage = {
      conversationId: "conversation-1",
      waMessageId: "wamid.1",
      type: "text",
      text: "Hola",
      sentAt: FIXED_NOW,
    };
    const first = await store.messages.insertInboundIfNew(inboundMessage);

    // Act
    const duplicate = await store.messages.insertInboundIfNew(inboundMessage);

    // Assert
    expect(first?.id).toBe("message-1");
    expect(first?.status).toBeNull();
    expect(duplicate).toBeNull();
    expect(store.allMessages()).toHaveLength(1);
  });

  it("stores an outbound message as queued without a waMessageId", async () => {
    // Arrange
    const store = new InMemoryConversationStore();

    // Act
    const message = await store.messages.insertOutbound({
      conversationId: "conversation-1",
      type: "text",
      text: "Hola, ¿en qué te ayudo?",
      sentAt: FIXED_NOW,
      sentByUserId: "user-1",
    });

    // Assert
    expect(message).toMatchObject({
      id: "message-1",
      direction: "outbound",
      status: "queued",
      waMessageId: null,
      failureReason: null,
      sentByUserId: "user-1",
    });
  });

  it("finds an outbound message by waMessageId after update saves it", async () => {
    // Arrange
    const store = new InMemoryConversationStore();
    const message = await store.messages.insertOutbound({
      conversationId: "conversation-1",
      type: "text",
      text: "Hola",
      sentAt: FIXED_NOW,
      sentByUserId: "user-1",
    });

    // Act
    await store.messages.update({ ...message, status: "sent", waMessageId: "wamid.sent" });

    // Assert
    const found = await store.messages.findByWaMessageId("wamid.sent");
    expect(found?.id).toBe(message.id);
    expect(found?.status).toBe("sent");
  });

  it("returns the result of a transaction that succeeds and keeps its changes", async () => {
    // Arrange
    const store = new InMemoryConversationStore();

    // Act
    const contact = await store.run(async (repositories) =>
      repositories.contacts.upsertByWaId({
        waId: CUSTOMER_WA_ID,
        profileName: "Ana",
        profileNameSearch: "ana",
      }),
    );

    // Assert
    expect(store.allContacts()).toEqual([contact]);
  });

  it("leaves no changes when the work of a transaction throws", async () => {
    // Arrange
    const store = new InMemoryConversationStore();
    await store.contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "Ana",
      profileNameSearch: "ana",
    });
    const contactsBefore = store.allContacts();

    // Act
    const transaction = store.run(async (repositories) => {
      await repositories.contacts.upsertByWaId({
        waId: CUSTOMER_WA_ID,
        profileName: "Renamed",
        profileNameSearch: "renamed",
      });
      const conversation = await repositories.conversations.findOrCreateForContact(
        "contact-1",
        FIXED_NOW,
      );
      await repositories.messages.insertInboundIfNew({
        conversationId: conversation.id,
        waMessageId: "wamid.1",
        type: "text",
        text: "Hola",
        sentAt: FIXED_NOW,
      });
      throw new SimulatedFailureError("simulated failure");
    });

    // Assert
    await expect(transaction).rejects.toThrow(SimulatedFailureError);
    expect(store.allContacts()).toEqual(contactsBefore);
    expect(store.allConversations()).toEqual([]);
    expect(store.allMessages()).toEqual([]);
  });

  it("returns copies so a test cannot change stored data by accident", async () => {
    // Arrange
    const store = new InMemoryConversationStore();
    const conversation = await store.conversations.findOrCreateForContact("contact-1", FIXED_NOW);

    // Act
    conversation.unreadCount = 99;

    // Assert
    expect(store.allConversations()[0]?.unreadCount).toBe(0);
  });
});
