"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { toThreadMessageJson } from "@/app/api/conversations/conversation-json";
import type { CurrentUser } from "@/modules/auth/domain/current-user";
import {
  ConversationNotFoundError,
  EmptyReplyTextError,
  OutsideCustomerServiceWindowError,
  ReplyTextTooLongError,
} from "@/modules/conversations/domain/errors";
import type { SendReplyResult } from "@/modules/conversations/ui/inbox-actions";
import { markConversationRead, sendTextReply } from "@/server/container";
import { requireSignedInUser } from "@/server/require-signed-in-user";
import type { AppError } from "@/shared/errors/app-error";

const INBOX_PATH = "/inbox";

const VALIDATION_ERROR_CODE = "VALIDATION_ERROR";

/**
 * Generous upper bound so a huge payload is rejected before any work. The real
 * WhatsApp limit (4096 characters) is checked by the use case, which answers
 * `REPLY_TEXT_TOO_LONG` so the screen can show the right reason (BR-004).
 */
const MAX_RAW_REPLY_TEXT_LENGTH = 10_000;

/** Errors that mean "nothing was sent, and here is why": returned to the screen, not thrown. */
const EXPECTED_REPLY_ERRORS = [
  OutsideCustomerServiceWindowError,
  EmptyReplyTextError,
  ReplyTextTooLongError,
  ConversationNotFoundError,
];

const conversationIdSchema = z.uuid();

const sendReplyInputSchema = z.object({
  conversationId: conversationIdSchema,
  text: z.string().max(MAX_RAW_REPLY_TEXT_LENGTH),
});

/**
 * Sends a free-form text reply (FR-015–FR-017). The 24h window, empty text and
 * length rules are checked by the use case; their codes come back as
 * `{ ok: false, error }` so the composer can show the reason (AC-5.3, AC-5.4).
 * A reply Meta rejected comes back as `ok: true` with a "failed" message (AC-5.5).
 */
export async function sendReplyAction(conversationId: string, text: string): Promise<SendReplyResult> {
  const user = await requireInboxUser();

  const parsed = sendReplyInputSchema.safeParse({ conversationId, text });
  if (!parsed.success) {
    return { ok: false, error: VALIDATION_ERROR_CODE };
  }

  try {
    const message = await sendTextReply({
      conversationId: parsed.data.conversationId,
      text: parsed.data.text,
      senderUserId: user.id,
      senderName: user.name,
    });
    return { ok: true, message: toThreadMessageJson(message) };
  } catch (error) {
    if (isExpectedReplyError(error)) {
      return { ok: false, error: error.code };
    }
    throw error;
  }
}

/**
 * Clears a conversation's unread counter for the whole team (FR-010, AC-3.4).
 * The screen calls it whenever an open conversation shows unread messages, so
 * an unknown (or malformed) id is ignored instead of failing the screen.
 */
export async function markConversationReadAction(conversationId: string): Promise<void> {
  await requireInboxUser();

  const parsed = conversationIdSchema.safeParse(conversationId);
  if (!parsed.success) {
    return;
  }

  try {
    await markConversationRead(parsed.data);
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return;
    }
    throw error;
  }
}

/**
 * Every action checks the session itself, FIRST (a layout or page guard is
 * not enough: actions can be called directly). Logged-out and
 * temporary-password users are redirected; admins and agents may both use the inbox.
 */
async function requireInboxUser(): Promise<CurrentUser> {
  // A copy, because the headers from `headers()` are read-only.
  const requestHeaders = new Headers(await headers());
  return requireSignedInUser({ requestHeaders, returnTo: INBOX_PATH });
}

function isExpectedReplyError(error: unknown): error is AppError {
  return EXPECTED_REPLY_ERRORS.some((errorClass) => error instanceof errorClass);
}
