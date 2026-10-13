/**
 * `/api/conversations/:id/messages` — one page of a conversation's thread (FR-013, FR-014, FR-021).
 *
 * `GET /api/conversations/:id/messages?before=<messageId>` (signed-in: admin or agent)
 *   `before` (optional, a message UUID): load the messages older than that one
 *   ("Cargar anteriores"). Without it, the newest page is returned.
 *   200: `{ "messages": [ { "id", "direction", "type", "text", "sentAt" (ISO date),
 *         "status", "failureReason", "senderName" } ], "hasOlder": boolean }`,
 *         oldest first (up to 50 per page). A UUID that matches no conversation
 *         returns an empty page; the screen learns it is missing from `/api/conversations/:id`.
 *   401 `UNAUTHENTICATED` · 403 `PASSWORD_CHANGE_REQUIRED` (temporary password)
 *   404 `CONVERSATION_NOT_FOUND` (an id that is not a UUID, AC-4.4)
 *   422 `VALIDATION_ERROR` (`before` is not a UUID: a client bug, not a missing conversation)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import { listConversationMessages, requireCurrentUser } from "@/server/container";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseSearchParams } from "@/shared/http/parse-search-params";

import { toMessagePageJson } from "../../conversation-json";
import { parseConversationIdParams, type ConversationIdRouteContext } from "../conversation-id-params";

const listMessagesQuerySchema = z.object({
  before: z.uuid().optional(),
});

/** Returns the newest page of messages, or the page older than `before`. */
export async function GET(request: Request, context: ConversationIdRouteContext): Promise<Response> {
  await connection();

  try {
    await requireCurrentUser(request.headers);
    const conversationId = await parseConversationIdParams(context);
    const { before } = parseSearchParams(request.url, listMessagesQuerySchema);

    const page = await listConversationMessages(conversationId, before ?? null);
    return Response.json(toMessagePageJson(page));
  } catch (error) {
    return toErrorResponse(error);
  }
}
