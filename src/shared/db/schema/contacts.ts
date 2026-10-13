import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A WhatsApp customer the business talks to.
 *
 * One row per WhatsApp number (BR-006): `wa_id` is UNIQUE so repeated webhooks for the
 * same number reuse the same contact instead of creating duplicates.
 */
export const contact = pgTable("contact", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Digits only, E.164 without "+", exactly as Meta sends it (AGENTS.md §8.9).
  waId: text("wa_id").notNull().unique(),
  // WhatsApp profile name; may be missing in the webhook.
  profileName: text("profile_name"),
  // `profile_name` normalized (lower case, no accents) so the inbox search ignores them.
  profileNameSearch: text("profile_name_search"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
