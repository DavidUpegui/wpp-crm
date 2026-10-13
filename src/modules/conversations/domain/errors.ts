// All intentional errors of the conversations module (each extends `AppError`
// with a stable `code`). Messages are in English and never contain phone
// numbers or message text, because errors may be logged.

import { AppError } from "@/shared/errors/app-error";

/** Thrown when a conversation id does not exist (AC-4.4). */
export class ConversationNotFoundError extends AppError {
  constructor() {
    super("CONVERSATION_NOT_FOUND", "The conversation does not exist.");
  }
}

/** Thrown when a free-form reply is attempted after the 24h window closed (BR-001, AC-5.3). */
export class OutsideCustomerServiceWindowError extends AppError {
  constructor() {
    super(
      "OUTSIDE_CUSTOMER_SERVICE_WINDOW",
      "Only templates can be sent after 24h without a customer message.",
    );
  }
}

/** Thrown when the reply is empty or only whitespace (BR-004, AC-5.4). */
export class EmptyReplyTextError extends AppError {
  constructor() {
    super("EMPTY_REPLY_TEXT", "The reply text is empty.");
  }
}

/** Thrown when the reply is longer than WhatsApp allows (BR-004, AC-5.4). */
export class ReplyTextTooLongError extends AppError {
  // The limit is passed in (not imported from reply-text.ts) to avoid a circular import.
  constructor(maxLength: number) {
    super("REPLY_TEXT_TOO_LONG", "The reply text is longer than the maximum allowed.", {
      maxLength: String(maxLength),
    });
  }
}

/** Thrown by a `MessageSender` when Meta rejects or cannot take the message (FR-017, AC-5.5). */
export class MessageSendFailedError extends AppError {
  /** Meta's error code, used to pick the user-facing reason; null when Meta gave none. */
  public readonly metaErrorCode: number | null;

  constructor(metaErrorCode: number | null) {
    super("MESSAGE_SEND_FAILED", "WhatsApp did not accept the message.");
    this.metaErrorCode = metaErrorCode;
  }
}
