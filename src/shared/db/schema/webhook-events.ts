import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Every WhatsApp webhook POST, stored raw BEFORE it is processed (AGENTS.md §8.5, FR-003).
 *
 * Keeping the raw body lets us replay events whose processing failed: those are the rows
 * with `processed_at IS NULL AND processing_error IS NOT NULL`.
 */
export const webhookEvent = pgTable("webhook_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  // Exact body as Meta sent it (the signature is computed over these bytes).
  rawBody: text("raw_body").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  // Null until processing succeeds.
  processedAt: timestamp("processed_at", { withTimezone: true }),
  // Set when processing failed, so the event can be found and replayed.
  processingError: text("processing_error"),
});
