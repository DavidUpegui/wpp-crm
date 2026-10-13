import "server-only";

import { and, desc, eq, ilike, like, or, sql, type SQL } from "drizzle-orm";

import { MESSAGE_PAGE_SIZE, type InboxQueries } from "@/modules/conversations/domain/inbox-queries";
import type {
  ConversationDetail,
  ConversationSummary,
  InboxContact,
  LastMessagePreview,
  MessagePage,
  ThreadMessage,
} from "@/modules/conversations/domain/inbox-views";
import { extractDigits, normalizeSearchText } from "@/modules/conversations/domain/search-text";
import type { DatabaseExecutor } from "@/shared/db/database";
import {
  contact as contactTable,
  conversation as conversationTable,
  message as messageTable,
  user as userTable,
} from "@/shared/db/schema";

// One extra row tells us whether an older page exists without a second COUNT query.
const MESSAGE_PAGE_QUERY_LIMIT = MESSAGE_PAGE_SIZE + 1;
const EMPTY_MESSAGE_PAGE: MessagePage = { messages: [], hasOlder: false };

type ContactRow = Pick<typeof contactTable.$inferSelect, "waId" | "profileName">;
type MessageRow = typeof messageTable.$inferSelect;

/**
 * `InboxQueries` backed by Postgres (Drizzle). It joins contacts, conversations,
 * messages and users into the read models the inbox screens show, and always
 * returns domain views, never raw rows.
 */
export class DrizzleInboxQueries implements InboxQueries {
  protected readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async listConversations(search: string | null): Promise<ConversationSummary[]> {
    const rows = await this.database
      .select({
        conversation: conversationTable,
        contact: contactTable,
        lastMessage: messageTable,
      })
      .from(conversationTable)
      .innerJoin(contactTable, eq(contactTable.id, conversationTable.contactId))
      .leftJoin(messageTable, eq(messageTable.id, conversationTable.lastMessageId))
      .where(buildSearchCondition(search))
      .orderBy(desc(conversationTable.lastActivityAt));

    return rows.map((row) => ({
      id: row.conversation.id,
      contact: mapRowToInboxContact(row.contact),
      lastMessage: row.lastMessage ? mapRowToLastMessagePreview(row.lastMessage) : null,
      lastActivityAt: row.conversation.lastActivityAt,
      unreadCount: row.conversation.unreadCount,
    }));
  }

  async getConversationDetail(conversationId: string): Promise<ConversationDetail | null> {
    const rows = await this.database
      .select({ conversation: conversationTable, contact: contactTable })
      .from(conversationTable)
      .innerJoin(contactTable, eq(contactTable.id, conversationTable.contactId))
      .where(eq(conversationTable.id, conversationId));

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.conversation.id,
      contact: mapRowToInboxContact(row.contact),
      lastInboundAt: row.conversation.lastInboundAt,
    };
  }

  async listMessages(conversationId: string, beforeMessageId: string | null): Promise<MessagePage> {
    if (beforeMessageId !== null) {
      const cursorExists = await this.messageExistsInConversation(conversationId, beforeMessageId);
      if (!cursorExists) {
        return EMPTY_MESSAGE_PAGE;
      }
    }

    const rows = await this.database
      .select({ message: messageTable, senderName: userTable.name })
      .from(messageTable)
      .leftJoin(userTable, eq(userTable.id, messageTable.sentByUserId))
      .where(
        and(
          eq(messageTable.conversationId, conversationId),
          buildOlderThanCursorCondition(beforeMessageId),
        ),
      )
      .orderBy(desc(messageTable.sentAt), desc(messageTable.id))
      .limit(MESSAGE_PAGE_QUERY_LIMIT);

    const hasOlder = rows.length === MESSAGE_PAGE_QUERY_LIMIT;
    const newestFirstPage = rows.slice(0, MESSAGE_PAGE_SIZE);
    const chronologicalPage = newestFirstPage.reverse();

    return {
      messages: chronologicalPage.map((row) => mapRowToThreadMessage(row.message, row.senderName)),
      hasOlder,
    };
  }

  /** True when the cursor message exists and belongs to this conversation. */
  private async messageExistsInConversation(
    conversationId: string,
    messageId: string,
  ): Promise<boolean> {
    const rows = await this.database
      .select({ id: messageTable.id })
      .from(messageTable)
      .where(and(eq(messageTable.id, messageId), eq(messageTable.conversationId, conversationId)));
    return rows.length > 0;
  }
}

/**
 * Matches the normalized contact name (case and accents ignored) or, when the
 * search has digits, the WhatsApp number (FR-012). Null search means no filter.
 */
function buildSearchCondition(search: string | null): SQL | undefined {
  if (search === null) {
    return undefined;
  }

  const namePattern = `%${escapeLikePattern(normalizeSearchText(search))}%`;
  const nameCondition = ilike(contactTable.profileNameSearch, namePattern);

  const digits = extractDigits(search);
  if (digits === "") {
    return nameCondition;
  }

  return or(nameCondition, like(contactTable.waId, `%${digits}%`));
}

/**
 * Keeps messages strictly older than the cursor on (sent_at, id). The cursor's
 * values are read in SQL (not round-tripped through a JS Date) so Postgres'
 * microsecond precision is preserved.
 */
function buildOlderThanCursorCondition(beforeMessageId: string | null): SQL | undefined {
  if (beforeMessageId === null) {
    return undefined;
  }

  return sql`(${messageTable.sentAt}, ${messageTable.id}) < (
    select cursor_message.sent_at, cursor_message.id
    from ${messageTable} as cursor_message
    where cursor_message.id = ${beforeMessageId}
  )`;
}

/**
 * Escapes the LIKE wildcards (`%`, `_`) and the escape character itself (`\`, Postgres'
 * default LIKE escape), so user input such as "50%" is searched as plain text.
 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function mapRowToInboxContact(row: ContactRow): InboxContact {
  return { waId: row.waId, profileName: row.profileName };
}

function mapRowToLastMessagePreview(row: MessageRow): LastMessagePreview {
  return {
    direction: row.direction,
    type: row.type,
    text: row.textBody,
    status: row.status,
  };
}

function mapRowToThreadMessage(row: MessageRow, senderName: string | null): ThreadMessage {
  return {
    id: row.id,
    direction: row.direction,
    type: row.type,
    text: row.textBody,
    sentAt: row.sentAt,
    status: row.status,
    failureReason: row.failureReason,
    senderName,
  };
}
