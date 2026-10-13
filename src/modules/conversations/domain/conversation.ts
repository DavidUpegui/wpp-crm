/**
 * The single inbox thread with one contact (spec §8). It caches what the
 * conversation list needs so the list does not have to scan every message.
 */
export interface Conversation {
  id: string;
  contactId: string;
  /** Time of the last customer message; drives the 24h customer service window. Null if none yet. */
  lastInboundAt: Date | null;
  /** Time of the latest message in either direction; sorts the conversation list. */
  lastActivityAt: Date;
  /** The message shown as preview in the conversation list. */
  lastMessageId: string | null;
  /** Inbound messages received since the conversation was last opened. */
  unreadCount: number;
}
