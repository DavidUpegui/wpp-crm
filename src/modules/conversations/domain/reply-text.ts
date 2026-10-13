// Reply text rule (BR-004): a reply must have visible text and fit WhatsApp's
// text body limit of 4096 characters.
// https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages

import { EmptyReplyTextError, ReplyTextTooLongError } from "./errors";

/** Longest text body WhatsApp accepts for a text message. */
export const MAX_REPLY_TEXT_LENGTH = 4096;

/**
 * Returns the reply text without surrounding whitespace, ready to send.
 * Throws `EmptyReplyTextError` or `ReplyTextTooLongError` when it breaks the rule.
 */
export function validateReplyText(text: string): string {
  const trimmedText = text.trim();

  if (trimmedText.length === 0) {
    throw new EmptyReplyTextError();
  }
  if (trimmedText.length > MAX_REPLY_TEXT_LENGTH) {
    throw new ReplyTextTooLongError(MAX_REPLY_TEXT_LENGTH);
  }
  return trimmedText;
}
