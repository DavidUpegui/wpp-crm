// Spanish copy of the inbox (spec 002 §10 and §12), written once so every
// component shows the same words. Failure reasons live in
// `failure-reason-messages.ts`; placeholders of non-text messages in
// `message-content-label.ts`.

import type { DeliveryStatus } from "@/modules/conversations/domain/message";
import { MAX_REPLY_TEXT_LENGTH } from "@/modules/conversations/domain/reply-text";

// ---------------------------------------------------------------------------
// Conversation list (left pane)
// ---------------------------------------------------------------------------

/** Placeholder of the search box above the conversation list (FR-012). */
export const SEARCH_PLACEHOLDER = "Buscar por nombre o número";

/** Empty state of the list when no customer has written yet (spec §10). */
export const NO_CONVERSATIONS_MESSAGE =
  "Aún no hay conversaciones. Cuando un cliente escriba al número de WhatsApp aparecerá aquí.";

/** Shown when the list cannot be loaded (spec §10). */
export const CONVERSATIONS_LOAD_ERROR_MESSAGE = "No se pudieron cargar las conversaciones.";

/** Button next to any load error that tries the same request again (spec §10). */
export const RETRY_LABEL = "Reintentar";

/** Empty state of the list when the search matches nothing (spec §10). */
export function formatNoSearchResultsMessage(search: string): string {
  return `Ninguna conversación coincide con «${search}».`;
}

// ---------------------------------------------------------------------------
// Conversation thread (right pane)
// ---------------------------------------------------------------------------

/** Right pane on desktop when no conversation is selected (spec §10). */
export const NO_CONVERSATION_SELECTED_MESSAGE = "Selecciona una conversación para verla.";

/** Shown for a conversation link that does not exist (AC-4.4, spec §12). */
export const CONVERSATION_NOT_FOUND_MESSAGE = "Esta conversación no existe";

/** Shown when the thread cannot be loaded (spec §10). */
export const CONVERSATION_LOAD_ERROR_MESSAGE = "No se pudo cargar la conversación.";

/** Button at the top of the thread that loads the previous page (AC-4.2). */
export const LOAD_OLDER_MESSAGES_LABEL = "Cargar anteriores";

/**
 * Read by screen readers before each message: sides and colours alone do not
 * say who wrote it (WCAG 1.3.1). Visually hidden.
 */
export const CUSTOMER_MESSAGE_PREFIX = "Cliente: ";
export const TEAM_MESSAGE_PREFIX = "Equipo: ";

/** Label of "Cargar anteriores" while the previous page is loading (spec §10). */
export const LOADING_LABEL = "Cargando…";

/** Link back to the list on mobile, where the thread is full screen (spec §10). */
export const BACK_TO_LIST_LABEL = "Volver";

// ---------------------------------------------------------------------------
// 24h customer service window (BR-001, AC-5.6)
// ---------------------------------------------------------------------------

/** Pill in the thread header once the 24h window is closed. */
export const WINDOW_CLOSED_LABEL = "Ventana cerrada";

/**
 * Pill in the thread header while the 24h window is open, e.g.
 * "Ventana abierta · cierra en 5 h". Partial hours are rounded down so the
 * pill never promises more time than is left; under one hour it says
 * "menos de 1 h" instead of "0 h".
 */
export function formatWindowOpenLabel(hoursLeft: number): string {
  if (hoursLeft < 1) {
    return "Ventana abierta · cierra en menos de 1 h";
  }
  return `Ventana abierta · cierra en ${Math.floor(hoursLeft)} h`;
}

/** Why the composer is disabled outside the 24h window (AC-5.3, spec §12). */
export const WINDOW_CLOSED_REASON =
  "La ventana de 24 h está cerrada. Solo se pueden enviar plantillas (próximamente).";

// ---------------------------------------------------------------------------
// Composer (FR-015, FR-016, AC-5.4)
// ---------------------------------------------------------------------------

/** Placeholder of the reply text box. */
export const COMPOSER_PLACEHOLDER = "Escribe una respuesta…";

/** Label of the send button. */
export const SEND_LABEL = "Enviar";

/** Inline validation when the reply is empty or only whitespace (spec §12). */
export const EMPTY_REPLY_MESSAGE = "Escribe un mensaje antes de enviarlo.";

/** Inline validation when the reply is over WhatsApp's limit (spec §12). */
export const REPLY_TOO_LONG_MESSAGE = `El mensaje supera el límite de ${MAX_REPLY_TEXT_LENGTH} caracteres.`;

/** Character counter shown near the limit, e.g. "3950 / 4096". */
export function formatCharacterCounter(length: number): string {
  return `${length} / ${MAX_REPLY_TEXT_LENGTH}`;
}

/**
 * Spanish text for each error `code` a reply Server Action can return, so a
 * server-side rejection (e.g. the window closed while typing) shows the same
 * words as the client-side check.
 */
export const REPLY_ERROR_MESSAGES: Record<string, string> = {
  OUTSIDE_CUSTOMER_SERVICE_WINDOW: WINDOW_CLOSED_REASON,
  EMPTY_REPLY_TEXT: EMPTY_REPLY_MESSAGE,
  REPLY_TEXT_TOO_LONG: REPLY_TOO_LONG_MESSAGE,
  CONVERSATION_NOT_FOUND: CONVERSATION_NOT_FOUND_MESSAGE,
};

// ---------------------------------------------------------------------------
// Delivery status of team messages (AC-6.1)
// ---------------------------------------------------------------------------

/**
 * Spanish label of each delivery status, shown next to its icon under every
 * team bubble. A `Record` so a new status fails typecheck until it has a label.
 */
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  queued: "Enviando",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "No enviado",
};

// ---------------------------------------------------------------------------
// Live connection (AC-7.2)
// ---------------------------------------------------------------------------

/** Discreet notice after the live connection has been down for a while. */
export const RECONNECTING_MESSAGE = "Reconectando…";
