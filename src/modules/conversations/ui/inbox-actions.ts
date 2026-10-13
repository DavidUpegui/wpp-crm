/**
 * What the inbox Server Actions (send a reply, mark a conversation as read)
 * take and return (FR-010, FR-015–FR-017).
 *
 * It lives in the UI module, not next to the actions in `src/app/`, so the
 * inbox components never import from the delivery layer: the page passes each
 * action down as a prop instead (AGENTS.md §5.1 — dependencies point inward).
 */
import type { DeliveryFailureReason, DeliveryStatus, MessageDirection } from "@/modules/conversations/domain/message";

/**
 * One thread message as it crosses from the server to the browser: the same
 * fields as the domain `ThreadMessage`, with dates as ISO 8601 strings
 * (a `Date` does not survive JSON). Also the shape of each message in
 * `GET /api/conversations/:id/messages`.
 */
export type ThreadMessageJson = {
  id: string;
  direction: MessageDirection;
  /** WhatsApp message type ("text", "image", "unsupported", …). */
  type: string;
  /** Text body; null for message types this spec does not show. */
  text: string | null;
  /** ISO 8601 date. */
  sentAt: string;
  /** Delivery status; only outbound messages have one. */
  status: DeliveryStatus | null;
  /** Only set when `status` is "failed". */
  failureReason: DeliveryFailureReason | null;
  /** Name of the sending team member; null for inbound messages or deleted users. */
  senderName: string | null;
};

/**
 * What `sendReplyAction` returns. A reply Meta rejected is still `ok: true`
 * (the message comes back as "failed" with its reason, AC-5.5); `ok: false`
 * means nothing was sent, with the `AppError` code saying why (window closed,
 * empty or too long text, unknown conversation, `VALIDATION_ERROR`).
 */
export type SendReplyResult = { ok: true; message: ThreadMessageJson } | { ok: false; error: string };

/** Sends a text reply to one conversation (provided by the page). */
export type SendReplyAction = (conversationId: string, text: string) => Promise<SendReplyResult>;

/** Clears the unread counter of one conversation for the whole team (provided by the page). */
export type MarkConversationReadAction = (conversationId: string) => Promise<void>;

/** The inbox Server Actions the page passes down to the inbox screen. */
export type InboxActions = {
  sendReply: SendReplyAction;
  markConversationRead: MarkConversationReadAction;
};
