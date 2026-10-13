import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { contact } from "./contacts";

/**
 * The single inbox thread with one contact (BR-005: one conversation per contact).
 *
 * It also caches what the conversation list needs (last activity, last message, unread
 * count) so the list does not have to scan every message.
 */
export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .unique()
      .references(() => contact.id),
    // Time of the last customer message; drives the 24h customer service window (AGENTS.md §8.2).
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    // Used to sort the conversation list (most recent first).
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
    // No FK constraint on purpose: message → conversation already exists, and a FK back
    // would be circular. Our code always writes a valid message id here.
    lastMessageId: uuid("last_message_id"),
    unreadCount: integer("unread_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Matches the conversation list query: ORDER BY last_activity_at DESC.
    // NULLS FIRST is Postgres' default for DESC, so the index matches a plain `desc()` query.
    index("conversation_last_activity_at_idx").on(table.lastActivityAt.desc().nullsFirst()),
  ],
);
