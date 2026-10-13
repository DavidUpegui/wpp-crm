"use client";

import { CircleAlert, MessageSquareOff } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ConversationDetail, ThreadMessage } from "@/modules/conversations/domain/inbox-views";
import {
  flattenMessagePages,
  InboxRequestError,
  useConversation,
  useConversationMessages,
} from "@/modules/conversations/ui/inbox-queries";
import { LoadOlderButton } from "@/modules/conversations/ui/load-older-button";
import { MessageBubble } from "@/modules/conversations/ui/message-bubble";
import { removeSavedPendingReplies } from "@/modules/conversations/ui/remove-saved-pending-replies";
import {
  CONVERSATION_LOAD_ERROR_MESSAGE,
  CONVERSATION_NOT_FOUND_MESSAGE,
  RETRY_LABEL,
} from "@/modules/conversations/ui/messages";
import { BackToListLink, ThreadHeader } from "@/modules/conversations/ui/thread-header";

/** Error code of the API for an unknown (or invalid) conversation id (AC-4.4). */
const CONVERSATION_NOT_FOUND_CODE = "CONVERSATION_NOT_FOUND";

/**
 * How close to the end (in px) still counts as "reading the latest messages":
 * a new message then scrolls the thread down; further up, the user is reading
 * history and is left where they are.
 */
const NEAR_BOTTOM_THRESHOLD_PX = 120;

/** Only for screen readers: names the live list of messages. */
const MESSAGES_HEADING = "Mensajes";

/** Sides of the placeholder bubbles while the thread loads: a believable back-and-forth. */
const SKELETON_BUBBLE_SIDES: readonly ("customer" | "team")[] = ["customer", "customer", "team", "customer", "team"];

/** Scroll position saved just before "Cargar anteriores", to keep the visible message in place. */
type ScrollSnapshot = { scrollHeight: number; scrollTop: number };

/** Props of {@link ConversationThread}. */
export interface ConversationThreadProps {
  conversationId: string;
  /** Where "Volver" goes on mobile. */
  backHref: string;
  /** The reply box, shown under the messages once the conversation has loaded. */
  composer: React.ReactNode;
  /** Replies still on their way to WhatsApp ("Enviando"), drawn after the loaded messages (AC-5.1). */
  pendingMessages: ThreadMessage[];
}

/**
 * The right pane of the inbox (FR-013, FR-014, AC-4.1–4.4): the header with
 * the 24h window, the messages oldest to newest with "Cargar anteriores" on
 * top, and the composer at the bottom. Opens scrolled to the newest message.
 */
export function ConversationThread({
  conversationId,
  backHref,
  composer,
  pendingMessages,
}: ConversationThreadProps): React.ReactElement {
  const conversationQuery = useConversation(conversationId);
  const messagesQuery = useConversationMessages(conversationId);

  // Data first: a failed background refetch keeps the thread on screen.
  if (conversationQuery.data !== undefined && messagesQuery.data !== undefined) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ThreadHeader conversation={conversationQuery.data} backHref={backHref} />
        <MessageList
          // A new conversation starts with fresh scroll state (first-load scroll to the bottom).
          // Prefixed because the composer next to it is keyed by the bare conversation id.
          key={`messages-${conversationId}`}
          conversation={conversationQuery.data}
          messages={flattenMessagePages(messagesQuery.data.pages)}
          pendingMessages={pendingMessages}
          pageCount={messagesQuery.data.pages.length}
          hasOlderMessages={messagesQuery.hasNextPage}
          isLoadingOlderMessages={messagesQuery.isFetchingNextPage}
          fetchOlderMessages={messagesQuery.fetchNextPage}
        />
        {composer}
      </div>
    );
  }

  if (isNotFoundError(conversationQuery.error) || isNotFoundError(messagesQuery.error)) {
    return <ThreadNotFound backHref={backHref} />;
  }

  if (conversationQuery.isError || messagesQuery.isError) {
    const retry = (): void => {
      void conversationQuery.refetch();
      void messagesQuery.refetch();
    };
    return <ThreadLoadError backHref={backHref} onRetry={retry} />;
  }

  return <ThreadLoading backHref={backHref} />;
}

type MessageListProps = {
  conversation: ConversationDetail;
  messages: ThreadMessage[];
  pendingMessages: ThreadMessage[];
  pageCount: number;
  hasOlderMessages: boolean;
  isLoadingOlderMessages: boolean;
  fetchOlderMessages: () => Promise<{ isError: boolean }>;
};

function MessageList({
  conversation,
  messages,
  pendingMessages,
  pageCount,
  hasOlderMessages,
  isLoadingOlderMessages,
  fetchOlderMessages,
}: MessageListProps): React.ReactElement {
  const headingId = useId();
  const visibleMessages = [...messages, ...removeSavedPendingReplies(pendingMessages, messages)];
  const { scrollContainerRef, handleScroll, loadOlderMessages } = useThreadScroll({
    newestMessageId: visibleMessages.at(-1)?.id ?? null,
    pendingMessageCount: pendingMessages.length,
    pageCount,
    fetchOlderMessages,
  });

  useKeepFocusWhenLoadOlderDisappears(hasOlderMessages, scrollContainerRef);

  const contactName = conversation.contact.profileName ?? `+${conversation.contact.waId}`;

  return (
    // Focusable so keyboard users can scroll the history with the arrow / Page keys.
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      tabIndex={0}
      role="region"
      aria-labelledby={headingId}
      className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:px-6"
    >
      <h3 id={headingId} className="sr-only">
        {`${MESSAGES_HEADING} con ${contactName}`}
      </h3>
      <LoadOlderButton
        hasOlderMessages={hasOlderMessages}
        isLoading={isLoadingOlderMessages}
        onLoadOlder={loadOlderMessages}
      />
      <ol aria-labelledby={headingId} aria-live="polite" className="flex flex-col">
        {visibleMessages.map((message, index) => (
          <li key={message.id} className={spacingBefore(visibleMessages[index - 1], message)}>
            <MessageBubble message={message} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * "Cargar anteriores" unmounts after the oldest page loads. If it had focus,
 * focus falls to <body>; move it to the message scroller instead, so a
 * keyboard user stays in the thread.
 */
function useKeepFocusWhenLoadOlderDisappears(
  hasOlderMessages: boolean,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
): void {
  const hadOlderMessagesRef = useRef(hasOlderMessages);

  useEffect(() => {
    // Only when the button just disappeared, not on the first render of a short thread.
    const hasButtonJustDisappeared = hadOlderMessagesRef.current && !hasOlderMessages;
    hadOlderMessagesRef.current = hasOlderMessages;
    if (!hasButtonJustDisappeared || document.activeElement !== document.body) {
      return;
    }
    scrollContainerRef.current?.focus({ preventScroll: true });
  }, [hasOlderMessages, scrollContainerRef]);
}

/**
 * The thread's three scroll behaviors (AC-4.1, AC-4.2):
 * 1. on first load, jump to the newest message;
 * 2. when a newer message is appended, follow it only if the user was near the bottom
 *    (always for a reply the user just sent: they want to see it go out);
 * 3. when older messages are prepended, keep the message on screen where it was
 *    (the content grows above it, so `scrollTop` grows by the same amount).
 */
function useThreadScroll({
  newestMessageId,
  pendingMessageCount,
  pageCount,
  fetchOlderMessages,
}: {
  newestMessageId: string | null;
  pendingMessageCount: number;
  pageCount: number;
  fetchOlderMessages: () => Promise<{ isError: boolean }>;
}): {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  loadOlderMessages: () => void;
} {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const hasScrolledInitiallyRef = useRef(false);
  const scrollSnapshotRef = useRef<ScrollSnapshot | null>(null);
  const previousPageCountRef = useRef(pageCount);
  const previousPendingMessageCountRef = useRef(pendingMessageCount);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (container === null) {
      return;
    }
    if (!hasScrolledInitiallyRef.current || isNearBottomRef.current) {
      hasScrolledInitiallyRef.current = true;
      scrollToBottom(container);
    }
  }, [newestMessageId]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const hasNewPendingMessage = pendingMessageCount > previousPendingMessageCountRef.current;
    previousPendingMessageCountRef.current = pendingMessageCount;

    if (container === null || !hasNewPendingMessage) {
      return;
    }
    isNearBottomRef.current = true;
    scrollToBottom(container);
  }, [pendingMessageCount]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const snapshot = scrollSnapshotRef.current;
    const hasGrown = pageCount > previousPageCountRef.current;
    previousPageCountRef.current = pageCount;

    if (container === null || snapshot === null || !hasGrown) {
      return;
    }
    container.scrollTop = snapshot.scrollTop + (container.scrollHeight - snapshot.scrollHeight);
    scrollSnapshotRef.current = null;
  }, [pageCount]);

  const handleScroll = useCallback((): void => {
    const container = scrollContainerRef.current;
    if (container === null) {
      return;
    }
    isNearBottomRef.current = distanceFromBottom(container) <= NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  const loadOlderMessages = useCallback((): void => {
    const container = scrollContainerRef.current;
    if (container !== null) {
      scrollSnapshotRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop };
    }
    void fetchOlderMessages().then((result) => {
      // Nothing was prepended: forget the snapshot so a later change is not "corrected".
      if (result.isError) {
        scrollSnapshotRef.current = null;
      }
    });
  }, [fetchOlderMessages]);

  return { scrollContainerRef, handleScroll, loadOlderMessages };
}

function ThreadNotFound({ backHref }: { backHref: string }): React.ReactElement {
  return (
    <CenteredThreadState backHref={backHref}>
      <EmptyState icon={MessageSquareOff} title={CONVERSATION_NOT_FOUND_MESSAGE} className="items-center text-center" />
    </CenteredThreadState>
  );
}

function ThreadLoadError({ backHref, onRetry }: { backHref: string; onRetry: () => void }): React.ReactElement {
  return (
    <CenteredThreadState backHref={backHref}>
      <EmptyState
        icon={CircleAlert}
        title={CONVERSATION_LOAD_ERROR_MESSAGE}
        className="items-center text-center"
        action={
          <Button type="button" variant="outline" onClick={onRetry}>
            {RETRY_LABEL}
          </Button>
        }
      />
    </CenteredThreadState>
  );
}

/** Calm full-pane message, with "Volver" on mobile so the user is never stuck. */
function CenteredThreadState({
  backHref,
  children,
}: {
  backHref: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="px-4 pt-3 md:hidden">
        <BackToListLink href={backHref} />
      </div>
      <div className="flex flex-1 items-center justify-center p-6">{children}</div>
    </div>
  );
}

/** Placeholder header and bubbles in the shape of the real thread, so nothing jumps on load. */
function ThreadLoading({ backHref }: { backHref: string }): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
        <BackToListLink href={backHref} />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-6 w-44 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden bg-background px-4 py-4 md:px-6">
        {SKELETON_BUBBLE_SIDES.map((side, index) => (
          <Skeleton
            key={index}
            className={cn(
              "h-10 rounded-bubble",
              side === "team" ? "w-1/2 self-end rounded-br-[4px]" : "w-2/5 self-start rounded-bl-[4px]",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** 4px between messages of the same side (a group), 12px when the side changes (plan §7b). */
function spacingBefore(previousMessage: ThreadMessage | undefined, message: ThreadMessage): string {
  if (previousMessage === undefined) {
    return "";
  }
  if (previousMessage.direction === message.direction) {
    return "mt-1";
  }
  return "mt-3";
}

function isNotFoundError(error: Error | null): boolean {
  return error instanceof InboxRequestError && error.code === CONVERSATION_NOT_FOUND_CODE;
}

function distanceFromBottom(container: HTMLElement): number {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function scrollToBottom(container: HTMLElement): void {
  container.scrollTop = container.scrollHeight;
}
