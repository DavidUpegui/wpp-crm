import "server-only";

import { eq, sql } from "drizzle-orm";

import type { Contact } from "@/modules/conversations/domain/contact";
import type {
  ContactRepository,
  UpsertContactInput,
} from "@/modules/conversations/domain/contact-repository";
import type { DatabaseExecutor } from "@/shared/db/database";
import { contact as contactTable } from "@/shared/db/schema";

type ContactRow = typeof contactTable.$inferSelect;

/**
 * `ContactRepository` backed by the `contact` table (Drizzle + Postgres). One row per
 * WhatsApp number: `wa_id` is UNIQUE, so the upsert reuses the existing contact (BR-006).
 * It receives the database (or a transaction) and never imports the global client.
 */
export class DrizzleContactRepository implements ContactRepository {
  private readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async findById(contactId: string): Promise<Contact | null> {
    const rows = await this.database
      .select()
      .from(contactTable)
      .where(eq(contactTable.id, contactId));
    return rows[0] ? toContact(rows[0]) : null;
  }

  async upsertByWaId(input: UpsertContactInput): Promise<Contact> {
    const rows = await this.database
      .insert(contactTable)
      .values({
        waId: input.waId,
        profileName: input.profileName,
        profileNameSearch: input.profileNameSearch,
      })
      .onConflictDoUpdate({
        target: contactTable.waId,
        // COALESCE keeps the stored name when the webhook brings none (AC-2.3).
        set: {
          profileName: sql`COALESCE(excluded.profile_name, ${contactTable.profileName})`,
          profileNameSearch: sql`COALESCE(excluded.profile_name_search, ${contactTable.profileNameSearch})`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toContact(rows[0]);
  }
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    waId: row.waId,
    profileName: row.profileName,
    createdAt: row.createdAt,
  };
}
