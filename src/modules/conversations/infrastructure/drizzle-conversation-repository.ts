import "server-only";

import { eq } from "drizzle-orm";

import type { Conversation } from "@/modules/conversations/domain/conversation";
import type { ConversationRepository } from "@/modules/conversations/domain/conversation-repository";
import type { DatabaseExecutor } from "@/shared/db/database";
import { conversation as conversationTable } from "@/shared/db/schema";

type ConversationRow = typeof conversationTable.$inferSelect;

/**
 * `ConversationRepository` backed by the `conversation` table (Drizzle + Postgres).
 * `contact_id` is UNIQUE, so there is exactly one conversation per contact (BR-005).
 * It receives the database (or a transaction) and never imports the global client.
 */
export class DrizzleConversationRepository implements ConversationRepository {
  private readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    const rows = await this.database
      .select()
      .from(conversationTable)
      .where(eq(conversationTable.id, conversationId));
    return rows[0] ? toConversation(rows[0]) : null;
  }

  async findOrCreateForContact(contactId: string, now: Date): Promise<Conversation> {
    // DO NOTHING keeps the existing conversation untouched; the select below reads
    // whichever row exists now (the new one or the one already stored).
    await this.database
      .insert(conversationTable)
      .values({ contactId, lastActivityAt: now })
      .onConflictDoNothing({ target: conversationTable.contactId });

    const rows = await this.database
      .select()
      .from(conversationTable)
      .where(eq(conversationTable.contactId, contactId));
    return toConversation(rows[0]);
  }

  async update(conversation: Conversation): Promise<void> {
    await this.database
      .update(conversationTable)
      .set({
        lastInboundAt: conversation.lastInboundAt,
        lastActivityAt: conversation.lastActivityAt,
        lastMessageId: conversation.lastMessageId,
        unreadCount: conversation.unreadCount,
        updatedAt: new Date(),
      })
      .where(eq(conversationTable.id, conversation.id));
  }
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    contactId: row.contactId,
    lastInboundAt: row.lastInboundAt,
    lastActivityAt: row.lastActivityAt,
    lastMessageId: row.lastMessageId,
    unreadCount: row.unreadCount,
  };
}
