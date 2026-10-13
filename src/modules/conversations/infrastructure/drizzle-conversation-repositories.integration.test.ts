// Integration tests for the Drizzle contact, conversation and message repositories and
// their transaction runner, against the real Postgres test database (`pnpm test:integration`).

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Conversation } from "@/modules/conversations/domain/conversation";
import { normalizeSearchText } from "@/modules/conversations/domain/search-text";
import {
  contact as contactTable,
  conversation as conversationTable,
  user as userTable,
} from "@/shared/db/schema";
import { createTestDatabase, resetAuthTables } from "../../../../tests/integration/test-database";

import { DrizzleContactRepository } from "./drizzle-contact-repository";
import { DrizzleConversationRepository } from "./drizzle-conversation-repository";
import { DrizzleConversationTransactionRunner } from "./drizzle-conversation-transaction-runner";
import { DrizzleMessageRepository } from "./drizzle-message-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const CUSTOMER_WA_ID = "573001234567";
const AGENT_USER_ID = "agent-user-1";
const NOW = new Date("2026-10-12T10:00:00.000Z");
const LATER = new Date("2026-10-12T10:05:00.000Z");

const testDatabase = createTestDatabase();
const database = testDatabase.database;
const contacts = new DrizzleContactRepository(database);
const conversations = new DrizzleConversationRepository(database);
const messages = new DrizzleMessageRepository(database);
const transactionRunner = new DrizzleConversationTransactionRunner(database);

beforeEach(async () => {
  await database.execute(sql`TRUNCATE "message", "conversation", "contact" CASCADE`);
  await resetAuthTables(database);
});

afterAll(async () => {
  await testDatabase.close();
});

async function upsertCustomer(profileName: string | null): Promise<string> {
  const contact = await contacts.upsertByWaId({
    waId: CUSTOMER_WA_ID,
    profileName,
    profileNameSearch: profileName === null ? null : normalizeSearchText(profileName),
  });
  return contact.id;
}

async function createCustomerConversation(): Promise<Conversation> {
  const contactId = await upsertCustomer("José");
  return conversations.findOrCreateForContact(contactId, NOW);
}

async function findStoredContactRow(waId: string): Promise<typeof contactTable.$inferSelect> {
  const rows = await database.select().from(contactTable).where(eq(contactTable.waId, waId));
  return rows[0];
}

async function insertAgentUser(): Promise<void> {
  await database
    .insert(userTable)
    .values({ id: AGENT_USER_ID, name: "Ana Pérez", email: "ana@example.com", role: "agent" });
}

describe("DrizzleContactRepository", () => {
  it("creates a contact for a new WhatsApp number with its searchable name", async () => {
    const contact = await contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "José",
      profileNameSearch: "jose",
    });

    expect(contact).toMatchObject({ waId: CUSTOMER_WA_ID, profileName: "José" });
    expect(contact.createdAt).toBeInstanceOf(Date);
    expect((await findStoredContactRow(CUSTOMER_WA_ID)).profileNameSearch).toBe("jose");
  });

  it("reuses the contact and updates its name and search name for the same number", async () => {
    const firstId = await upsertCustomer("José");

    const updated = await contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: "María",
      profileNameSearch: "maria",
    });

    expect(updated.id).toBe(firstId);
    expect(updated.profileName).toBe("María");
    expect((await findStoredContactRow(CUSTOMER_WA_ID)).profileNameSearch).toBe("maria");
    expect(await database.select().from(contactTable)).toHaveLength(1);
  });

  it("keeps the stored name when the webhook brings no name", async () => {
    await upsertCustomer("José");

    const updated = await contacts.upsertByWaId({
      waId: CUSTOMER_WA_ID,
      profileName: null,
      profileNameSearch: null,
    });

    expect(updated.profileName).toBe("José");
    expect((await findStoredContactRow(CUSTOMER_WA_ID)).profileNameSearch).toBe("jose");
  });

  it("finds a contact by id and returns null for an unknown id", async () => {
    const contactId = await upsertCustomer("José");

    expect(await contacts.findById(contactId)).toMatchObject({
      id: contactId,
      waId: CUSTOMER_WA_ID,
      profileName: "José",
    });
    expect(await contacts.findById(MISSING_ID)).toBeNull();
  });
});

describe("DrizzleConversationRepository", () => {
  it("creates the conversation with the given activity time and no unread messages", async () => {
    const conversation = await createCustomerConversation();

    expect(conversation).toMatchObject({
      lastInboundAt: null,
      lastActivityAt: NOW,
      lastMessageId: null,
      unreadCount: 0,
    });
  });

  it("returns the same conversation for the same contact", async () => {
    const first = await createCustomerConversation();

    const second = await conversations.findOrCreateForContact(first.contactId, LATER);

    expect(second.id).toBe(first.id);
    expect(second.lastActivityAt).toEqual(NOW);
  });

  it("saves the updated activity, last message and unread count", async () => {
    const conversation = await createCustomerConversation();
    const message = await messages.insertInboundIfNew({
      conversationId: conversation.id,
      waMessageId: "wamid.inbound-1",
      type: "text",
      text: "Hola",
      sentAt: LATER,
    });

    await conversations.update({
      ...conversation,
      lastInboundAt: LATER,
      lastActivityAt: LATER,
      lastMessageId: message?.id ?? null,
      unreadCount: 1,
    });

    expect(await conversations.findById(conversation.id)).toEqual({
      ...conversation,
      lastInboundAt: LATER,
      lastActivityAt: LATER,
      lastMessageId: message?.id,
      unreadCount: 1,
    });
  });

  it("returns null for an unknown conversation id", async () => {
    expect(await conversations.findById(MISSING_ID)).toBeNull();
  });
});

describe("DrizzleMessageRepository", () => {
  it("stores an inbound message without delivery status", async () => {
    const conversation = await createCustomerConversation();

    const message = await messages.insertInboundIfNew({
      conversationId: conversation.id,
      waMessageId: "wamid.inbound-1",
      type: "text",
      text: "Hola",
      sentAt: NOW,
    });

    expect(message).toMatchObject({
      conversationId: conversation.id,
      direction: "inbound",
      waMessageId: "wamid.inbound-1",
      text: "Hola",
      sentAt: NOW,
      status: null,
      failureReason: null,
      sentByUserId: null,
    });
  });

  it("returns null when the same wa_message_id arrives again", async () => {
    const conversation = await createCustomerConversation();
    const inbound = {
      conversationId: conversation.id,
      waMessageId: "wamid.inbound-1",
      type: "text",
      text: "Hola",
      sentAt: NOW,
    };
    await messages.insertInboundIfNew(inbound);

    expect(await messages.insertInboundIfNew(inbound)).toBeNull();
  });

  it("stores an outbound reply as queued, then saves its wamid and status", async () => {
    await insertAgentUser();
    const conversation = await createCustomerConversation();

    const queued = await messages.insertOutbound({
      conversationId: conversation.id,
      type: "text",
      text: "¡Hola! ¿En qué te ayudo?",
      sentAt: NOW,
      sentByUserId: AGENT_USER_ID,
    });
    expect(queued).toMatchObject({
      direction: "outbound",
      waMessageId: null,
      status: "queued",
      failureReason: null,
      sentByUserId: AGENT_USER_ID,
    });

    await messages.update({ ...queued, waMessageId: "wamid.outbound-1", status: "sent" });

    expect(await messages.findByWaMessageId("wamid.outbound-1")).toEqual({
      ...queued,
      waMessageId: "wamid.outbound-1",
      status: "sent",
    });
  });

  it("saves the failure reason of a failed reply", async () => {
    await insertAgentUser();
    const conversation = await createCustomerConversation();
    const queued = await messages.insertOutbound({
      conversationId: conversation.id,
      type: "text",
      text: "Hola",
      sentAt: NOW,
      sentByUserId: AGENT_USER_ID,
    });

    await messages.update({
      ...queued,
      waMessageId: "wamid.outbound-2",
      status: "failed",
      failureReason: "outside_window",
    });

    expect(await messages.findByWaMessageId("wamid.outbound-2")).toMatchObject({
      status: "failed",
      failureReason: "outside_window",
    });
  });

  it("returns null for an unknown wa_message_id", async () => {
    expect(await messages.findByWaMessageId("wamid.unknown")).toBeNull();
  });
});

describe("DrizzleConversationTransactionRunner", () => {
  it("commits the contact, conversation and message written in the work", async () => {
    const messageId = await transactionRunner.run(async (repositories) => {
      const contact = await repositories.contacts.upsertByWaId({
        waId: CUSTOMER_WA_ID,
        profileName: "José",
        profileNameSearch: "jose",
      });
      const conversation = await repositories.conversations.findOrCreateForContact(contact.id, NOW);
      const message = await repositories.messages.insertInboundIfNew({
        conversationId: conversation.id,
        waMessageId: "wamid.inbound-1",
        type: "text",
        text: "Hola",
        sentAt: NOW,
      });
      return message?.id;
    });

    expect(messageId).toBeDefined();
    expect(await messages.findByWaMessageId("wamid.inbound-1")).not.toBeNull();
  });

  it("rolls everything back and rethrows when the work throws", async () => {
    const failure = new Error("processing failed");

    await expect(
      transactionRunner.run(async (repositories) => {
        const contact = await repositories.contacts.upsertByWaId({
          waId: CUSTOMER_WA_ID,
          profileName: "José",
          profileNameSearch: "jose",
        });
        const conversation = await repositories.conversations.findOrCreateForContact(
          contact.id,
          NOW,
        );
        await repositories.messages.insertInboundIfNew({
          conversationId: conversation.id,
          waMessageId: "wamid.inbound-1",
          type: "text",
          text: "Hola",
          sentAt: NOW,
        });
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await database.select().from(contactTable)).toHaveLength(0);
    expect(await database.select().from(conversationTable)).toHaveLength(0);
    expect(await messages.findByWaMessageId("wamid.inbound-1")).toBeNull();
  });
});
