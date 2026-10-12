import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Failed login attempts, used by the login rate limit (BR-004).
 *
 * Only FAILED attempts are stored: the rule counts recent failures per email + IP
 * address, and a successful login clears them. Rows older than the rate-limit window
 * no longer count and can be deleted.
 */
export const loginAttempt = pgTable(
  "login_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stored normalized (trimmed, lower case) so "A@x.com" and "a@x.com" count together.
    email: text("email").notNull(),
    ipAddress: text("ip_address").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Matches the rate-limit query: failures for one email + IP since a point in time.
    index("login_attempt_email_ip_address_attempted_at_idx").on(
      table.email,
      table.ipAddress,
      table.attemptedAt,
    ),
  ],
);
