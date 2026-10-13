import type { Message } from "./message";

/** A customer message to store; it has no delivery status (inbound). */
export interface NewInboundMessage {
  conversationId: string;
  waMessageId: string;
  type: string;
  text: string | null;
  sentAt: Date;
}

/** A team reply to store; it starts as "queued" with no `waMessageId` (AGENTS.md §8.8). */
export interface NewOutboundMessage {
  conversationId: string;
  type: string;
  text: string;
  sentAt: Date;
  sentByUserId: string;
}

/**
 * Stores messages of both directions. Used by `recordInboundMessage`,
 * `sendTextReply` and `applyMessageStatus`. Throws no domain errors; database
 * failures propagate.
 */
export interface MessageRepository {
  /**
   * Inserts the message unless one with the same `waMessageId` already exists.
   * Returns null for such a duplicate, so the caller can skip its side effects
   * (BR-002, AGENTS.md §8.6).
   */
  insertInboundIfNew(message: NewInboundMessage): Promise<Message | null>;

  /** Inserts a team reply with status "queued" and returns it. */
  insertOutbound(message: NewOutboundMessage): Promise<Message>;

  /** Returns the message Meta knows by `waMessageId`, or null if we have none. */
  findByWaMessageId(waMessageId: string): Promise<Message | null>;

  /** Saves `status`, `failureReason` and `waMessageId` of an existing message. */
  update(message: Message): Promise<void>;
}
