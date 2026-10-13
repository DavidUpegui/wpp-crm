import type { Conversation } from "./conversation";

/**
 * Stores conversations (one per contact). Used by the write use cases
 * (`recordInboundMessage`, `sendTextReply`, `markConversationRead`).
 * Throws no domain errors: a missing conversation is returned as null and the
 * use case decides whether that is a `ConversationNotFoundError`.
 */
export interface ConversationRepository {
  /** Returns the conversation, or null when the id does not exist. */
  findById(conversationId: string): Promise<Conversation | null>;

  /**
   * Returns the contact's conversation, creating it (with `lastActivityAt = now`,
   * no unread messages) when it does not exist yet.
   */
  findOrCreateForContact(contactId: string, now: Date): Promise<Conversation>;

  /** Saves `lastInboundAt`, `lastActivityAt`, `lastMessageId` and `unreadCount`. */
  update(conversation: Conversation): Promise<void>;
}
