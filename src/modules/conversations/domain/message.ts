/** Whether the customer sent the message (inbound) or the team did (outbound). */
export type MessageDirection = "inbound" | "outbound";

/**
 * Delivery status of an outbound message (AGENTS.md §8.7).
 * Order: queued < sent < delivered < read; failed is final.
 */
export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

/**
 * Why an outbound message was not sent, in our own words, so the UI can show
 * a clear Spanish reason instead of a Meta error code.
 */
export type DeliveryFailureReason =
  | "outside_window"
  | "recipient_not_allowed"
  | "undeliverable"
  | "rate_limited"
  | "access_token_invalid"
  | "unknown";

/** One WhatsApp message in a conversation, received or sent (spec §8). */
export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  /** Meta's "wamid"; null while an outbound message is still queued. */
  waMessageId: string | null;
  /** WhatsApp message type ("text", "image", "unsupported", …). */
  type: string;
  /** Text body; null for message types this spec does not show. */
  text: string | null;
  /** WhatsApp time for inbound messages, creation time for outbound ones (BR-007). */
  sentAt: Date;
  /** Delivery status; only outbound messages have one. */
  status: DeliveryStatus | null;
  /** Only set when `status` is "failed". */
  failureReason: DeliveryFailureReason | null;
  /** The team member who sent an outbound message; null for inbound or deleted users. */
  sentByUserId: string | null;
}
