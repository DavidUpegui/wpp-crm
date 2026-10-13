import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { conversation } from "./conversations";

// Kept local on purpose: the schema must not import feature modules.
type MessageDirection = "inbound" | "outbound";
type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";
type MessageFailureReason =
  | "outside_window"
  | "recipient_not_allowed"
  | "undeliverable"
  | "rate_limited"
  | "access_token_invalid"
  | "unknown";

/**
 * One WhatsApp message in a conversation, received (inbound) or sent by the team (outbound).
 *
 * `wa_message_id` is UNIQUE so the same webhook delivered twice cannot create two rows (BR-002).
 */
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id),
    direction: text("direction").$type<MessageDirection>().notNull(),
    // Meta's "wamid". Null while an outbound message is still queued; Postgres allows many NULLs.
    waMessageId: text("wa_message_id").unique(),
    // WhatsApp message type ("text", "image", "unsupported", …); only text is shown in this spec.
    type: text("type").notNull(),
    textBody: text("text_body"),
    // BR-007: WhatsApp timestamp for inbound messages, creation time for outbound ones.
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    // Delivery status; outbound messages only (AGENTS.md §8.7, never downgraded).
    status: text("status").$type<MessageStatus>(),
    // Why an outbound message failed; only set when status is "failed".
    failureReason: text("failure_reason").$type<MessageFailureReason>(),
    // The agent who sent it; kept as null if that user is deleted.
    sentByUserId: text("sent_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Matches the keyset pagination of a thread: newest first, id as tie-breaker.
    // NULLS FIRST is Postgres' default for DESC, so the index matches a plain `desc()` query.
    index("message_conversation_id_sent_at_id_idx").on(
      table.conversationId,
      table.sentAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
  ],
);
