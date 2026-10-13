"use client";

/**
 * Live inbox updates (FR-020, AC-7.1, AC-7.2): listens to the Server-Sent
 * Events of `/api/realtime` and tells TanStack Query which inbox data is
 * stale, so the list and the open thread refetch on their own.
 *
 * Events only carry ids (AGENTS.md §10); the data itself is always read
 * again through the normal `/api/conversations` queries.
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";

import { INBOX_QUERY_KEYS } from "./inbox-queries";

const REALTIME_URL = "/api/realtime";

/** A short network blip should not flash a warning; only show it after this long. */
const RECONNECTING_NOTICE_DELAY_MS = 5_000;

/** When the browser gives up (e.g. 401), wait this long before opening a new stream. */
const RECREATE_DELAY_MS = 5_000;

/** Prefixes of every inbox query: invalidating them refetches all inbox data. */
const ALL_INBOX_QUERY_PREFIXES = [
  INBOX_QUERY_KEYS.conversations,
  ["conversation"],
  ["messages"],
] as const;

const inboxEventSchema = z.object({
  type: z.literal("conversation_updated"),
  conversationId: z.string(),
});

type InboxEvent = z.infer<typeof inboxEventSchema>;

/** What the inbox screen needs to know about the live connection. */
export type InboxLiveUpdates = {
  /** True after the stream has been down for a few seconds ("Reconectando…"). */
  isReconnecting: boolean;
};

/** Mutable state of one live connection, owned by one effect run. */
type LiveConnection = {
  source: EventSource | null;
  reconnectingNoticeTimer: ReturnType<typeof setTimeout> | null;
  recreateTimer: ReturnType<typeof setTimeout> | null;
  hasHadError: boolean;
};

type LiveConnectionCallbacks = {
  onInboxEvent: (event: InboxEvent) => void;
  onReconnected: () => void;
  onReconnectingChange: (isReconnecting: boolean) => void;
};

/**
 * Keeps the inbox in sync with changes made by webhooks and other users
 * while the screen is open. Use it once, from the inbox screen.
 */
export function useInboxLiveUpdates(): InboxLiveUpdates {
  const queryClient = useQueryClient();
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const stopLiveConnection = startLiveConnection({
      onInboxEvent: (event) => invalidateConversation(queryClient, event.conversationId),
      onReconnected: () => invalidateAllInboxQueries(queryClient),
      onReconnectingChange: setIsReconnecting,
    });
    return stopLiveConnection;
  }, [queryClient]);

  return { isReconnecting };
}

/** Opens the event stream and keeps it alive; returns the function that stops everything. */
function startLiveConnection(callbacks: LiveConnectionCallbacks): () => void {
  const connection: LiveConnection = {
    source: null,
    reconnectingNoticeTimer: null,
    recreateTimer: null,
    hasHadError: false,
  };

  function openSource(): void {
    connection.recreateTimer = null;
    const source = new EventSource(REALTIME_URL);
    source.onopen = () => handleOpen(connection, callbacks);
    source.onmessage = (messageEvent) => handleMessage(messageEvent, callbacks);
    source.onerror = () => handleError(connection, callbacks, openSource);
    connection.source = source;
  }

  openSource();
  return () => stopConnection(connection);
}

function handleOpen(connection: LiveConnection, callbacks: LiveConnectionCallbacks): void {
  clearConnectionTimers(connection);
  if (connection.hasHadError) {
    // Events sent while we were disconnected are lost, so catch up on everything.
    callbacks.onReconnected();
  }
  connection.hasHadError = false;
  callbacks.onReconnectingChange(false);
}

function handleMessage(messageEvent: MessageEvent, callbacks: LiveConnectionCallbacks): void {
  const inboxEvent = parseInboxEvent(messageEvent.data);
  if (!inboxEvent) {
    return;
  }
  callbacks.onInboxEvent(inboxEvent);
}

function handleError(
  connection: LiveConnection,
  callbacks: LiveConnectionCallbacks,
  openSource: () => void,
): void {
  connection.hasHadError = true;
  startReconnectingNoticeTimer(connection, callbacks);

  const source = connection.source;
  if (!source || source.readyState !== EventSource.CLOSED) {
    // The browser is retrying on its own; `onopen` fires when it succeeds.
    return;
  }

  source.close();
  connection.source = null;
  if (connection.recreateTimer === null) {
    connection.recreateTimer = setTimeout(openSource, RECREATE_DELAY_MS);
  }
}

function startReconnectingNoticeTimer(
  connection: LiveConnection,
  callbacks: LiveConnectionCallbacks,
): void {
  if (connection.reconnectingNoticeTimer !== null) {
    return;
  }
  connection.reconnectingNoticeTimer = setTimeout(() => {
    callbacks.onReconnectingChange(true);
  }, RECONNECTING_NOTICE_DELAY_MS);
}

function stopConnection(connection: LiveConnection): void {
  clearConnectionTimers(connection);
  connection.source?.close();
  connection.source = null;
}

function clearConnectionTimers(connection: LiveConnection): void {
  if (connection.reconnectingNoticeTimer !== null) {
    clearTimeout(connection.reconnectingNoticeTimer);
    connection.reconnectingNoticeTimer = null;
  }
  if (connection.recreateTimer !== null) {
    clearTimeout(connection.recreateTimer);
    connection.recreateTimer = null;
  }
}

/** Returns the event, or `null` for anything that is not valid JSON of a known event. */
function parseInboxEvent(data: unknown): InboxEvent | null {
  if (typeof data !== "string") {
    return null;
  }
  try {
    const result = inboxEventSchema.safeParse(JSON.parse(data));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function invalidateConversation(queryClient: QueryClient, conversationId: string): void {
  void queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEYS.conversations });
  void queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEYS.conversation(conversationId) });
  void queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEYS.messages(conversationId) });
}

function invalidateAllInboxQueries(queryClient: QueryClient): void {
  for (const queryKeyPrefix of ALL_INBOX_QUERY_PREFIXES) {
    void queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
  }
}
