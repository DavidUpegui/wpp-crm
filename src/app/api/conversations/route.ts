/**
 * `/api/conversations` — the inbox conversation list (FR-011, FR-012, FR-021).
 *
 * `GET /api/conversations?search=` (signed-in: admin or agent)
 *   `search` (optional, max 200 characters): matches the contact name ignoring
 *   case and accents, or part of the WhatsApp number. Empty means "no filter".
 *   200: `{ "conversations": [ { "id", "contact": { "waId", "profileName" },
 *         "lastMessage": { "direction", "type", "text", "status" } | null,
 *         "lastActivityAt" (ISO date), "unreadCount" } ] }`, most recent activity first.
 *   401 `UNAUTHENTICATED` · 403 `PASSWORD_CHANGE_REQUIRED` (temporary password)
 *   422 `VALIDATION_ERROR` (search longer than 200 characters)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import type { ConversationSummary } from "@/modules/conversations/domain/inbox-views";
import { listConversations, requireCurrentUser } from "@/server/container";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseSearchParams } from "@/shared/http/parse-search-params";

import { toConversationSummaryJson, type ConversationSummaryJson } from "./conversation-json";

/** Longer searches are not a real name or number; capping them keeps the query cheap. */
const MAX_SEARCH_LENGTH = 200;

const listConversationsQuerySchema = z.object({
  search: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
});

/** Lists the inbox conversations, optionally filtered by contact name or number. */
export async function GET(request: Request): Promise<Response> {
  await connection();

  try {
    await requireCurrentUser(request.headers);
    const { search } = parseSearchParams(request.url, listConversationsQuerySchema);

    const conversations = await listConversations(search ?? null);
    return Response.json(toConversationsBody(conversations));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toConversationsBody(conversations: ConversationSummary[]): { conversations: ConversationSummaryJson[] } {
  return { conversations: conversations.map(toConversationSummaryJson) };
}
