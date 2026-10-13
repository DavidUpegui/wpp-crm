/**
 * `/api/conversations/:id` — the header data of one open conversation (FR-013, FR-018, FR-021).
 *
 * `GET /api/conversations/:id` (signed-in: admin or agent)
 *   200: `{ "conversation": { "id", "contact": { "waId", "profileName" },
 *         "lastInboundAt" (ISO date or null) } }`. `lastInboundAt` drives the 24h window indicator.
 *   401 `UNAUTHENTICATED` · 403 `PASSWORD_CHANGE_REQUIRED` (temporary password)
 *   404 `CONVERSATION_NOT_FOUND` (unknown id, or an id that is not a UUID, AC-4.4)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";

import { getConversation, requireCurrentUser } from "@/server/container";
import { toErrorResponse } from "@/shared/http/json-error-response";

import { toConversationDetailJson } from "../conversation-json";
import { parseConversationIdParams, type ConversationIdRouteContext } from "./conversation-id-params";

/** Returns the contact and 24h window data of one conversation. */
export async function GET(request: Request, context: ConversationIdRouteContext): Promise<Response> {
  await connection();

  try {
    await requireCurrentUser(request.headers);
    const conversationId = await parseConversationIdParams(context);

    const conversation = await getConversation(conversationId);
    return Response.json({ conversation: toConversationDetailJson(conversation) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
