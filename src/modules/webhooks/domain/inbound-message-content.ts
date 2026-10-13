import type { MetaInboundMessage } from "./meta-webhook-payload";

// Reads what the CRM stores from an inbound WhatsApp message: its type and, when the
// type is supported, its text. Meta's message types:
// https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages

/**
 * The part of an inbound message the CRM keeps. `text` is null for types the CRM
 * does not support yet (image, reaction, unsupported…); the inbox shows a placeholder.
 */
export type InboundMessageContent = {
  type: string;
  text: string | null;
};

/** Turns one inbound message of a known type into the content the CRM stores. */
type InboundContentReader = (message: MetaInboundMessage) => InboundMessageContent;

/**
 * One reader per supported message type (Open/Closed): supporting a new type means
 * adding a reader here, never editing `readInboundMessageContent`.
 */
export const INBOUND_CONTENT_READERS: Record<string, InboundContentReader> = {
  // A text message without a body is unexpected; it is kept as text with no content
  // instead of failing the whole webhook.
  text: (message) => ({ type: "text", text: message.text?.body ?? null }),
};

/**
 * Returns the stored content of an inbound message. Types without a reader keep
 * their Meta type (including "unsupported") and have no text, so the inbox shows a
 * placeholder instead of losing the message.
 */
export function readInboundMessageContent(message: MetaInboundMessage): InboundMessageContent {
  if (!Object.hasOwn(INBOUND_CONTENT_READERS, message.type)) {
    return { type: message.type, text: null };
  }

  const readContent = INBOUND_CONTENT_READERS[message.type];
  return readContent(message);
}
