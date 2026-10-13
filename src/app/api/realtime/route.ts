/**
 * `/api/realtime` — live inbox updates as Server-Sent Events (FR-020, FR-021, AC-7.1).
 *
 * `GET /api/realtime` (signed-in user)
 *   200 `text/event-stream` that stays open until the browser closes it:
 *   - `: connected` comment right after the stream opens.
 *   - `data: { "type": "conversation_updated", "conversationId": string }` for each
 *     inbox change (`NOTIFY inbox_events`). The client refetches what changed.
 *   - `: ping` comment every 25 s so proxies and the browser keep the connection open.
 *   401 `UNAUTHENTICATED` · 403 `PASSWORD_CHANGE_REQUIRED` (JSON, before the stream starts)
 *
 * Each open stream holds its own Postgres `LISTEN` connection, released when
 * the browser disconnects (AGENTS.md §10). Event payloads are never logged.
 */
import { connection } from "next/server";

import { requireCurrentUser, subscribeToInboxEvents } from "@/server/container";
import { toErrorResponse } from "@/shared/http/json-error-response";
import type { Unsubscribe } from "@/shared/realtime/subscribe-to-channel";

const PING_INTERVAL_MS = 25_000;

const CONNECTED_COMMENT = ": connected\n\n";
const PING_COMMENT = ": ping\n\n";

const EVENT_STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Tells nginx-like proxies not to buffer the stream.
  "X-Accel-Buffering": "no",
};

/** Opens the inbox event stream for a signed-in user. */
export async function GET(request: Request): Promise<Response> {
  await connection();

  try {
    await requireCurrentUser(request.headers);
  } catch (error) {
    return toErrorResponse(error);
  }

  const stream = createInboxEventStream(request.signal);
  return new Response(stream, { headers: EVENT_STREAM_HEADERS });
}

/**
 * Builds the SSE stream. The stream can end from three places (browser abort,
 * stream cancel, failed subscription), so `stopStream` is safe to call more
 * than once and nothing is written after it ran.
 */
function createInboxEventStream(abortSignal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let isStopped = false;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: Unsubscribe | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

  function write(text: string): void {
    if (isStopped || streamController === undefined) {
      return;
    }
    streamController.enqueue(encoder.encode(text));
  }

  async function stopStream(): Promise<void> {
    if (isStopped) {
      return;
    }
    isStopped = true;
    clearInterval(pingTimer);
    closeControllerSafely(streamController);
    await unsubscribeSafely(unsubscribe);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller): Promise<void> {
      streamController = controller;
      abortSignal.addEventListener("abort", () => void stopStream(), { once: true });

      try {
        unsubscribe = await subscribeToInboxEvents((event) => {
          write(`data: ${JSON.stringify(event)}\n\n`);
        });
      } catch (error) {
        await stopStream();
        console.error(`Realtime subscription failed: ${errorMessage(error)}`);
        return;
      }

      // The browser may have left while we were connecting to Postgres:
      // `stopStream` already ran without a subscription to release, so release it now.
      if (isStopped) {
        await unsubscribeSafely(unsubscribe);
        return;
      }
      if (abortSignal.aborted) {
        await stopStream();
        return;
      }

      write(CONNECTED_COMMENT);
      pingTimer = setInterval(() => write(PING_COMMENT), PING_INTERVAL_MS);
    },
    async cancel(): Promise<void> {
      await stopStream();
    },
  });
}

function closeControllerSafely(
  controller: ReadableStreamDefaultController<Uint8Array> | undefined,
): void {
  try {
    controller?.close();
  } catch {
    // Already closed or cancelled by the browser; nothing left to close.
  }
}

async function unsubscribeSafely(unsubscribe: Unsubscribe | undefined): Promise<void> {
  if (unsubscribe === undefined) {
    return;
  }
  try {
    await unsubscribe();
  } catch (error) {
    console.error(`Realtime unsubscribe failed: ${errorMessage(error)}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
