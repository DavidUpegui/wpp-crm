import type { ConversationDetail, ConversationSummary, MessagePage } from "./inbox-views";

/**
 * How many messages one thread page holds (FR-014). Defined here, next to the
 * query that uses it, because it is a property of the read side.
 */
export const MESSAGE_PAGE_SIZE = 50;

/**
 * The read side of the inbox: ready-to-show views for the conversation list and
 * the open thread (FR-011–FR-014). Kept apart from the repositories because it
 * joins several tables and never writes. Throws no domain errors: a missing
 * conversation is returned as null.
 */
export interface InboxQueries {
  /**
   * Lists conversations, most recent activity first. `search` (already trimmed,
   * null for no filter) matches the contact name ignoring case and accents, or
   * the digits of the WhatsApp number (FR-012).
   */
  listConversations(search: string | null): Promise<ConversationSummary[]>;

  /** Returns the header data of one conversation, or null when the id does not exist. */
  getConversationDetail(conversationId: string): Promise<ConversationDetail | null>;

  /**
   * Returns up to `MESSAGE_PAGE_SIZE` messages older than `beforeMessageId`
   * (the newest ones when null), in chronological order.
   */
  listMessages(conversationId: string, beforeMessageId: string | null): Promise<MessagePage>;
}
