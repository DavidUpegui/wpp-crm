/**
 * A WhatsApp customer the business talks to (spec §8). There is one contact per
 * WhatsApp number, so `waId` identifies it.
 */
export interface Contact {
  id: string;
  /** WhatsApp number as Meta sends it: digits only, E.164 without "+" (AGENTS.md §8.9). */
  waId: string;
  /** WhatsApp profile name; null when the webhook did not include one. */
  profileName: string | null;
  createdAt: Date;
}
