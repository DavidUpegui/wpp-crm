/** What Meta returns when it accepts a message. */
export interface SentMessageReceipt {
  /** Meta's "wamid", used later to match status webhooks (FR-019). */
  waMessageId: string;
}

/**
 * Sends WhatsApp messages through Meta (FR-017). The use case checks the 24h
 * window and the text before calling it; this only delivers.
 */
export interface MessageSender {
  /**
   * Sends a free-form text to `toWaId` (digits only).
   * Throws `MessageSendFailedError` (with Meta's error code, or null) when Meta
   * rejects the message or cannot be reached.
   */
  sendText(toWaId: string, text: string): Promise<SentMessageReceipt>;
}
