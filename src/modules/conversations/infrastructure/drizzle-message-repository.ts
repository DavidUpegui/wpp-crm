import "server-only";

import { eq } from "drizzle-orm";

import type { Message } from "@/modules/conversations/domain/message";
import type {
  MessageRepository,
  NewInboundMessage,
  NewOutboundMessage,
} from "@/modules/conversations/domain/message-repository";
import type { DatabaseExecutor } from "@/shared/db/database";
import { message as messageTable } from "@/shared/db/schema";

type MessageRow = typeof messageTable.$inferSelect;

/**
 * `MessageRepository` backed by the `message` table (Drizzle + Postgres).
 * `wa_message_id` is UNIQUE, so a webhook delivered twice cannot create two rows
 * (BR-002, AGENTS.md §8.6). It receives the database (or a transaction) and never
 * imports the global client.
 */
export class DrizzleMessageRepository implements MessageRepository {
  private readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async insertInboundIfNew(newMessage: NewInboundMessage): Promise<Message | null> {
    const rows = await this.database
      .insert(messageTable)
      .values({
        conversationId: newMessage.conversationId,
        direction: "inbound",
        waMessageId: newMessage.waMessageId,
        type: newMessage.type,
        textBody: newMessage.text,
        sentAt: newMessage.sentAt,
      })
      .onConflictDoNothing({ target: messageTable.waMessageId })
      .returning();

    // No returned row means the message was already stored (duplicate webhook).
    return rows[0] ? toMessage(rows[0]) : null;
  }

  async insertOutbound(newMessage: NewOutboundMessage): Promise<Message> {
    // Starts as "queued" without a wamid; Meta's answer fills them in (AGENTS.md §8.8).
    const rows = await this.database
      .insert(messageTable)
      .values({
        conversationId: newMessage.conversationId,
        direction: "outbound",
        waMessageId: null,
        type: newMessage.type,
        textBody: newMessage.text,
        sentAt: newMessage.sentAt,
        status: "queued",
        sentByUserId: newMessage.sentByUserId,
      })
      .returning();
    return toMessage(rows[0]);
  }

  async findByWaMessageId(waMessageId: string): Promise<Message | null> {
    const rows = await this.database
      .select()
      .from(messageTable)
      .where(eq(messageTable.waMessageId, waMessageId));
    return rows[0] ? toMessage(rows[0]) : null;
  }

  async update(message: Message): Promise<void> {
    // Only the delivery fields can change after a message is stored.
    await this.database
      .update(messageTable)
      .set({
        status: message.status,
        failureReason: message.failureReason,
        waMessageId: message.waMessageId,
        updatedAt: new Date(),
      })
      .where(eq(messageTable.id, message.id));
  }
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction,
    waMessageId: row.waMessageId,
    type: row.type,
    text: row.textBody,
    sentAt: row.sentAt,
    status: row.status,
    failureReason: row.failureReason,
    sentByUserId: row.sentByUserId,
  };
}
