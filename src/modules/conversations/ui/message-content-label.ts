// Text shown for a message in the thread and the list preview. This spec only
// shows text messages; any other type gets a Spanish placeholder (FR-008,
// AC-2.4, spec §12).

import type { Message } from "@/modules/conversations/domain/message";

const TEXT_MESSAGE_TYPE = "text";

/** Spanish names of the WhatsApp message types we can receive but not show yet. */
const SPANISH_MESSAGE_TYPE_NAMES: Record<string, string> = {
  image: "imagen",
  audio: "audio",
  video: "video",
  document: "documento",
  sticker: "sticker",
  location: "ubicación",
  contacts: "contacto",
  reaction: "reacción",
  interactive: "interactivo",
  button: "botón",
};

/** The two message fields needed to pick the label. */
type MessageContent = Pick<Message, "type" | "text">;

/**
 * Whether the message is shown as a placeholder instead of its text, so the
 * bubble can style it differently (dashed outline, italic).
 */
export function isUnsupportedMessage(message: MessageContent): boolean {
  return message.type !== TEXT_MESSAGE_TYPE || message.text === null;
}

/**
 * Text to show for a message: its body for text messages, otherwise
 * "Mensaje de tipo <tipo> no soportado aún" (unknown types keep their raw name).
 */
export function describeMessageContent(message: MessageContent): string {
  if (message.type === TEXT_MESSAGE_TYPE && message.text !== null) {
    return message.text;
  }
  return `Mensaje de tipo ${toSpanishTypeName(message.type)} no soportado aún`;
}

// `Object.hasOwn` so a type like "constructor" is not read from the prototype.
function toSpanishTypeName(messageType: string): string {
  if (Object.hasOwn(SPANISH_MESSAGE_TYPE_NAMES, messageType)) {
    return SPANISH_MESSAGE_TYPE_NAMES[messageType];
  }
  return messageType;
}
