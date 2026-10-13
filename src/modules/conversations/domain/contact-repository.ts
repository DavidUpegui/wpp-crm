import type { Contact } from "./contact";

/** The data needed to create or refresh a contact from an inbound message. */
export interface UpsertContactInput {
  /** WhatsApp number, digits only; identifies the contact. */
  waId: string;
  profileName: string | null;
  /** `profileName` in searchable form (`normalizeSearchText`); null when there is no name. */
  profileNameSearch: string | null;
}

/**
 * Stores contacts (one per WhatsApp number). Used by `recordInboundMessage`
 * and `sendTextReply` inside a transaction. Throws no domain errors; database
 * failures propagate.
 */
export interface ContactRepository {
  /**
   * Returns the contact, or null when the id does not exist. `sendTextReply`
   * uses it to learn the WhatsApp number to send the reply to.
   */
  findById(contactId: string): Promise<Contact | null>;

  /**
   * Creates the contact for `waId`, or updates its name if it already exists
   * (AC-2.3). A null `profileName` never erases a name already stored.
   */
  upsertByWaId(input: UpsertContactInput): Promise<Contact>;
}
