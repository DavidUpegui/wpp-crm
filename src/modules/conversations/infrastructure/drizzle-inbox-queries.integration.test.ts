// Integration tests for the Drizzle inbox queries, against the real Postgres test
// database (`pnpm test:integration`). Fixture rows are inserted directly with Drizzle.

import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { MESSAGE_PAGE_SIZE } from "@/modules/conversations/domain/inbox-queries";
import { normalizeSearchText } from "@/modules/conversations/domain/search-text";
import {
  contact as contactTable,
  conversation as conversationTable,
  message as messageTable,
  user as userTable,
} from "@/shared/db/schema";
import { createTestDatabase, resetAuthTables } from "../../../../tests/integration/test-database";

import { DrizzleInboxQueries } from "./drizzle-inbox-queries";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const AGENT_USER_ID = "agent-user-1";
const AGENT_NAME = "Ana Pérez";
const BASE_TIME_MS = Date.parse("2026-10-01T12:00:00.000Z");
const ONE_MINUTE_MS = 60 * 1000;
const LONG_THREAD_MESSAGE_COUNT = 120;

const testDatabase = createTestDatabase();
const database = testDatabase.database;
const inboxQueries = new DrizzleInboxQueries(database);

beforeEach(async () => {
  await database.execute(sql`TRUNCATE "message", "conversation", "contact" CASCADE`);
  await resetAuthTables(database);
});

afterAll(async () => {
  await testDatabase.close();
});

function minutesAfterBase(minutes: number): Date {
  return new Date(BASE_TIME_MS + minutes * ONE_MINUTE_MS);
}

async function insertConversation(input: {
  waId: string;
  profileName: string | null;
  lastActivityAt: Date;
  lastInboundAt?: Date | null;
}): Promise<string> {
  const [contactRow] = await database
    .insert(contactTable)
    .values({
      waId: input.waId,
      profileName: input.profileName,
      profileNameSearch: input.profileName === null ? null : normalizeSearchText(input.profileName),
    })
    .returning({ id: contactTable.id });

  const [conversationRow] = await database
    .insert(conversationTable)
    .values({
      contactId: contactRow.id,
      lastActivityAt: input.lastActivityAt,
      lastInboundAt: input.lastInboundAt ?? null,
    })
    .returning({ id: conversationTable.id });

  return conversationRow.id;
}

async function insertMessage(input: {
  conversationId: string;
  direction: "inbound" | "outbound";
  text: string;
  sentAt: Date;
  sentByUserId?: string;
}): Promise<string> {
  const isOutbound = input.direction === "outbound";
  const [row] = await database
    .insert(messageTable)
    .values({
      conversationId: input.conversationId,
      direction: input.direction,
      type: "text",
      textBody: input.text,
      sentAt: input.sentAt,
      status: isOutbound ? "sent" : null,
      sentByUserId: input.sentByUserId ?? null,
    })
    .returning({ id: messageTable.id });
  return row.id;
}

async function insertAgentUser(): Promise<void> {
  await database
    .insert(userTable)
    .values({ id: AGENT_USER_ID, name: AGENT_NAME, email: "ana@example.com", role: "agent" });
}

async function insertLongThread(conversationId: string): Promise<void> {
  const rows = [];
  for (let index = 0; index < LONG_THREAD_MESSAGE_COUNT; index += 1) {
    rows.push({
      conversationId,
      direction: "inbound" as const,
      type: "text",
      textBody: `Mensaje ${index}`,
      sentAt: minutesAfterBase(index),
    });
  }
  await database.insert(messageTable).values(rows);
}

describe("DrizzleInboxQueries.listConversations", () => {
  it("lists conversations with the newest activity first, with contact and last message preview", async () => {
    const olderId = await insertConversation({
      waId: "573001111111",
      profileName: "Laura",
      lastActivityAt: minutesAfterBase(1),
    });
    const newerId = await insertConversation({
      waId: "573002222222",
      profileName: "Carlos",
      lastActivityAt: minutesAfterBase(5),
    });
    const lastMessageId = await insertMessage({
      conversationId: newerId,
      direction: "inbound",
      text: "Hola",
      sentAt: minutesAfterBase(5),
    });
    await database
      .update(conversationTable)
      .set({ lastMessageId, unreadCount: 1 })
      .where(sql`${conversationTable.id} = ${newerId}`);

    const summaries = await inboxQueries.listConversations(null);

    expect(summaries.map((summary) => summary.id)).toEqual([newerId, olderId]);
    expect(summaries[0]).toEqual({
      id: newerId,
      contact: { waId: "573002222222", profileName: "Carlos" },
      lastMessage: { direction: "inbound", type: "text", text: "Hola", status: null },
      lastActivityAt: minutesAfterBase(5),
      unreadCount: 1,
    });
    expect(summaries[1].lastMessage).toBeNull();
  });

  it("finds a name ignoring case and accents", async () => {
    const joseId = await insertConversation({
      waId: "573001111111",
      profileName: "José Gómez",
      lastActivityAt: minutesAfterBase(1),
    });
    await insertConversation({ waId: "573002222222", profileName: "Laura", lastActivityAt: minutesAfterBase(2) });

    const summaries = await inboxQueries.listConversations("jose");

    expect(summaries.map((summary) => summary.id)).toEqual([joseId]);
  });

  it("finds a contact by the digits of the number, ignoring spaces and the plus sign", async () => {
    const matchingId = await insertConversation({
      waId: "573001234567",
      profileName: "Laura",
      lastActivityAt: minutesAfterBase(1),
    });
    await insertConversation({ waId: "441234000000", profileName: "Carlos", lastActivityAt: minutesAfterBase(2) });

    const bySpacedDigits = await inboxQueries.listConversations("300 123");
    const byInternationalPrefix = await inboxQueries.listConversations("+57300");

    expect(bySpacedDigits.map((summary) => summary.id)).toEqual([matchingId]);
    expect(byInternationalPrefix.map((summary) => summary.id)).toEqual([matchingId]);
  });

  it("matches the % character literally instead of as a wildcard", async () => {
    const percentId = await insertConversation({
      waId: "573001111111",
      profileName: "Promo 50% off",
      lastActivityAt: minutesAfterBase(1),
    });
    await insertConversation({ waId: "573002222222", profileName: "Laura", lastActivityAt: minutesAfterBase(2) });

    const summaries = await inboxQueries.listConversations("%");

    expect(summaries.map((summary) => summary.id)).toEqual([percentId]);
  });
});

describe("DrizzleInboxQueries.getConversationDetail", () => {
  it("returns the contact and last inbound time of the conversation", async () => {
    const conversationId = await insertConversation({
      waId: "573001111111",
      profileName: null,
      lastActivityAt: minutesAfterBase(3),
      lastInboundAt: minutesAfterBase(2),
    });

    const detail = await inboxQueries.getConversationDetail(conversationId);

    expect(detail).toEqual({
      id: conversationId,
      contact: { waId: "573001111111", profileName: null },
      lastInboundAt: minutesAfterBase(2),
    });
  });

  it("returns null when the conversation does not exist", async () => {
    await expect(inboxQueries.getConversationDetail(MISSING_ID)).resolves.toBeNull();
  });
});

describe("DrizzleInboxQueries.listMessages", () => {
  it("pages a long thread from newest to oldest, each page in chronological order", async () => {
    const conversationId = await insertConversation({
      waId: "573001111111",
      profileName: "Laura",
      lastActivityAt: minutesAfterBase(LONG_THREAD_MESSAGE_COUNT),
    });
    await insertLongThread(conversationId);

    const newestPage = await inboxQueries.listMessages(conversationId, null);
    expect(newestPage.hasOlder).toBe(true);
    expect(newestPage.messages).toHaveLength(MESSAGE_PAGE_SIZE);
    expect(newestPage.messages[0].text).toBe("Mensaje 70");
    expect(newestPage.messages[MESSAGE_PAGE_SIZE - 1].text).toBe("Mensaje 119");

    const middlePage = await inboxQueries.listMessages(conversationId, newestPage.messages[0].id);
    expect(middlePage.hasOlder).toBe(true);
    expect(middlePage.messages[0].text).toBe("Mensaje 20");
    expect(middlePage.messages[MESSAGE_PAGE_SIZE - 1].text).toBe("Mensaje 69");

    const oldestPage = await inboxQueries.listMessages(conversationId, middlePage.messages[0].id);
    expect(oldestPage.hasOlder).toBe(false);
    expect(oldestPage.messages.map((message) => message.text)).toEqual(
      Array.from({ length: 20 }, (_, index) => `Mensaje ${index}`),
    );
  });

  it("includes the sender's name on outbound messages and null on inbound ones", async () => {
    await insertAgentUser();
    const conversationId = await insertConversation({
      waId: "573001111111",
      profileName: "Laura",
      lastActivityAt: minutesAfterBase(2),
    });
    await insertMessage({ conversationId, direction: "inbound", text: "Hola", sentAt: minutesAfterBase(1) });
    const outboundId = await insertMessage({
      conversationId,
      direction: "outbound",
      text: "Buenos días",
      sentAt: minutesAfterBase(2),
      sentByUserId: AGENT_USER_ID,
    });

    const page = await inboxQueries.listMessages(conversationId, null);

    expect(page.hasOlder).toBe(false);
    expect(page.messages[0].senderName).toBeNull();
    expect(page.messages[1]).toEqual({
      id: outboundId,
      direction: "outbound",
      type: "text",
      text: "Buenos días",
      sentAt: minutesAfterBase(2),
      status: "sent",
      failureReason: null,
      senderName: AGENT_NAME,
    });
  });

  it("returns an empty page when the cursor message is unknown", async () => {
    const conversationId = await insertConversation({
      waId: "573001111111",
      profileName: "Laura",
      lastActivityAt: minutesAfterBase(1),
    });
    await insertMessage({ conversationId, direction: "inbound", text: "Hola", sentAt: minutesAfterBase(1) });

    const page = await inboxQueries.listMessages(conversationId, MISSING_ID);

    expect(page).toEqual({ messages: [], hasOlder: false });
  });
});
