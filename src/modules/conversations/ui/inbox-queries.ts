/**
 * Inbox data for the browser (FR-011, FR-013, FR-014): the JSON shapes of the
 * `/api/conversations` routes, the TanStack Query keys, and the hooks the
 * inbox components use to read conversations and messages.
 *
 * The JSON types live here, not next to the routes in `src/app/`, so the UI
 * never imports from the delivery layer; the routes import them from here
 * instead (AGENTS.md §5.1 — dependencies point inward).
 *
 * Use these hooks only from client components, inside `AppQueryClientProvider`.
 */
import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  ConversationDetail,
  ConversationSummary,
  InboxContact,
  LastMessagePreview,
  MessagePage,
  ThreadMessage,
} from "@/modules/conversations/domain/inbox-views";
import { AppError } from "@/shared/errors/app-error";

import type { ThreadMessageJson } from "./inbox-actions";

/** Used when an error response has no readable `{ error: { code } }` body (e.g. a proxy error page). */
const UNKNOWN_ERROR_CODE = "INBOX_REQUEST_FAILED";

/** Retrying cannot fix these: the conversation does not exist, or the session is gone. */
const NON_RETRYABLE_STATUSES: readonly number[] = [401, 404];

/** Same as TanStack Query's default, for errors that may be temporary (network, 5xx). */
const MAX_RETRIES = 3;

/** One row of `GET /api/conversations`. */
export type ConversationSummaryJson = {
  id: string;
  contact: InboxContact;
  lastMessage: LastMessagePreview | null;
  /** ISO 8601 date. */
  lastActivityAt: string;
  unreadCount: number;
};

/** The body of `GET /api/conversations/:id`'s `conversation` field. */
export type ConversationDetailJson = {
  id: string;
  contact: InboxContact;
  /** ISO 8601 date, or `null` when the customer never wrote. */
  lastInboundAt: string | null;
};

/** The body of `GET /api/conversations/:id/messages`. */
export type MessagePageJson = {
  messages: ThreadMessageJson[];
  hasOlder: boolean;
};

/**
 * Query keys of the inbox. They are prefixes of each other on purpose: the
 * live-updates hook invalidates `conversations` to refresh every list
 * (whatever the search), and `conversation(id)` / `messages(id)` for one thread.
 */
export const INBOX_QUERY_KEYS = {
  conversations: ["conversations"] as const,
  conversationList: (search: string) => ["conversations", search] as const,
  conversation: (conversationId: string) => ["conversation", conversationId] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
};

/**
 * Thrown when an inbox API call answers with a non-OK status. Keeps the HTTP
 * status and the server's error `code`, so the screen can tell
 * "Esta conversación no existe" (404 `CONVERSATION_NOT_FOUND`) from a
 * failure worth retrying.
 */
export class InboxRequestError extends AppError {
  public readonly status: number;

  constructor(status: number, code: string) {
    super(code, `Inbox request failed with status ${status} (${code}).`);
    this.status = status;
  }
}

/** Reads the conversation list, filtered by name or number when `search` is not empty. */
export function useConversations(search: string): UseQueryResult<ConversationSummary[]> {
  return useQuery({
    queryKey: INBOX_QUERY_KEYS.conversationList(search),
    queryFn: () => fetchConversations(search),
    // While a new search loads, keep showing the previous rows instead of flashing placeholders.
    placeholderData: keepPreviousData,
    retry: shouldRetry,
  });
}

/** Reads the header data of the open conversation; does nothing while no conversation is open. */
export function useConversation(conversationId: string | null): UseQueryResult<ConversationDetail> {
  return useQuery({
    queryKey: INBOX_QUERY_KEYS.conversation(conversationId ?? ""),
    queryFn: conversationId ? () => fetchConversation(conversationId) : skipToken,
    retry: shouldRetry,
  });
}

/**
 * Reads the thread of the open conversation, one page at a time. The first
 * page is the newest; each next page ("Cargar anteriores") is OLDER, fetched
 * with the `before` cursor = oldest message id of the last page loaded.
 * Use `flattenMessagePages` to get every message in chronological order.
 */
export function useConversationMessages(
  conversationId: string | null,
): UseInfiniteQueryResult<InfiniteData<MessagePage, string | null>> {
  return useInfiniteQuery({
    queryKey: INBOX_QUERY_KEYS.messages(conversationId ?? ""),
    queryFn: conversationId
      ? ({ pageParam }) => fetchMessagePage(conversationId, pageParam)
      : skipToken,
    initialPageParam: null as string | null,
    getNextPageParam: getOlderPageCursor,
    retry: shouldRetry,
  });
}

/**
 * Joins the loaded pages into one list, oldest message first. Pages are
 * stored newest page first, while each page is already oldest-first, so the
 * pages are read from the last (oldest) to the first (newest).
 */
export function flattenMessagePages(pages: readonly MessagePage[]): ThreadMessage[] {
  const messages: ThreadMessage[] = [];
  for (let pageIndex = pages.length - 1; pageIndex >= 0; pageIndex -= 1) {
    messages.push(...pages[pageIndex].messages);
  }
  return messages;
}

/**
 * Turns a message received as JSON back into a `ThreadMessage` with a real
 * `Date`.
 */
function toThreadMessage(json: ThreadMessageJson): ThreadMessage {
  return {
    id: json.id,
    direction: json.direction,
    type: json.type,
    text: json.text,
    sentAt: new Date(json.sentAt),
    status: json.status,
    failureReason: json.failureReason,
    senderName: json.senderName,
  };
}

async function fetchConversations(search: string): Promise<ConversationSummary[]> {
  const parameters = new URLSearchParams();
  if (search !== "") {
    parameters.set("search", search);
  }

  const body = await fetchJson<{ conversations: ConversationSummaryJson[] }>(
    withQueryString("/api/conversations", parameters),
  );
  return body.conversations.map(toConversationSummary);
}

async function fetchConversation(conversationId: string): Promise<ConversationDetail> {
  const body = await fetchJson<{ conversation: ConversationDetailJson }>(
    `/api/conversations/${encodeURIComponent(conversationId)}`,
  );
  return toConversationDetail(body.conversation);
}

async function fetchMessagePage(conversationId: string, beforeMessageId: string | null): Promise<MessagePage> {
  const parameters = new URLSearchParams();
  if (beforeMessageId) {
    parameters.set("before", beforeMessageId);
  }

  const body = await fetchJson<MessagePageJson>(
    withQueryString(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, parameters),
  );
  return { messages: body.messages.map(toThreadMessage), hasOlder: body.hasOlder };
}

/** The type parameter is trusted: the routes build these bodies with the JSON types above. */
async function fetchJson<Body>(url: string): Promise<Body> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new InboxRequestError(response.status, await readErrorCode(response));
  }
  return (await response.json()) as Body;
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    return extractErrorCode(body) ?? UNKNOWN_ERROR_CODE;
  } catch {
    return UNKNOWN_ERROR_CODE;
  }
}

function extractErrorCode(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return null;
  }
  const error = body.error;
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

function withQueryString(path: string, parameters: URLSearchParams): string {
  const queryString = parameters.toString();
  if (queryString === "") {
    return path;
  }
  return `${path}?${queryString}`;
}

function getOlderPageCursor(lastPage: MessagePage): string | undefined {
  if (!lastPage.hasOlder) {
    return undefined;
  }
  return lastPage.messages[0]?.id;
}

function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof InboxRequestError && NON_RETRYABLE_STATUSES.includes(error.status)) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

function toConversationSummary(json: ConversationSummaryJson): ConversationSummary {
  return {
    id: json.id,
    contact: json.contact,
    lastMessage: json.lastMessage,
    lastActivityAt: new Date(json.lastActivityAt),
    unreadCount: json.unreadCount,
  };
}

function toConversationDetail(json: ConversationDetailJson): ConversationDetail {
  return {
    id: json.id,
    contact: json.contact,
    lastInboundAt: json.lastInboundAt ? new Date(json.lastInboundAt) : null,
  };
}
