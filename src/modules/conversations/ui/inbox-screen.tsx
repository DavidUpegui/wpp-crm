"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, WifiOff } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/modules/conversations/domain/inbox-views";
import { ConversationList } from "@/modules/conversations/ui/conversation-list";
import { ConversationThread } from "@/modules/conversations/ui/conversation-thread";
import type {
  InboxActions,
  MarkConversationReadAction,
  SendReplyAction,
} from "@/modules/conversations/ui/inbox-actions";
import { INBOX_QUERY_KEYS, useConversation, useConversations } from "@/modules/conversations/ui/inbox-queries";
import { NO_CONVERSATION_SELECTED_MESSAGE, RECONNECTING_MESSAGE } from "@/modules/conversations/ui/messages";
import { ReplyComposer, usePendingReplies } from "@/modules/conversations/ui/reply-composer";
import { useInboxLiveUpdates } from "@/modules/conversations/ui/use-inbox-live-updates";

const INBOX_PATH = "/inbox";

/** Same query parameter the conversation list writes (FR-012). */
const SEARCH_QUERY_PARAM = "q";

const INBOX_TITLE = "Bandeja";

/** Placeholder rows of the list pane while the page loads. */
const SKELETON_ROW_COUNT = 6;

/**
 * The inbox takes all the height `<main>` has left (under the mobile top bar,
 * or the full screen beside the desktop sidebar). The panes are positioned
 * absolutely inside it, so their content never makes the page taller: each
 * pane scrolls on its own and the composer stays at the bottom.
 */
const FRAME_CLASS_NAME = "relative min-h-0 flex-1";
const PANES_CLASS_NAME = "absolute inset-0 flex";

const LIST_PANE_CLASS_NAME = "min-h-0 w-full flex-col bg-card md:flex md:w-[340px] md:shrink-0 md:border-r md:border-border";
const THREAD_PANE_CLASS_NAME = "min-h-0 min-w-0 flex-1 flex-col bg-background md:flex";

/** Props of {@link InboxScreen}. */
export interface InboxScreenProps {
  actions: InboxActions;
}

/** Route params of `/inbox/[[...conversationId]]`: missing at `/inbox`. */
type InboxRouteParams = {
  conversationId?: string[];
};

/**
 * The inbox (FR-010, FR-020, FR-021, plan §7b): the conversation list on the
 * left and the open conversation on the right. Below `md` only one pane is
 * shown: the list at `/inbox`, the thread (with "Volver") at `/inbox/<id>`.
 *
 * It keeps the screen live (SSE) and clears the unread counter of the open
 * conversation for the whole team whenever new messages arrive in it (AC-3.3, AC-3.4).
 *
 * It is rendered by the inbox layout, which stays mounted while the user
 * moves between conversations, so it reads the open conversation from the
 * URL itself instead of receiving it from the page (which Next.js remounts).
 */
export function InboxScreen({ actions }: InboxScreenProps): React.ReactElement {
  const { isReconnecting } = useInboxLiveUpdates();
  const routeParams = useParams<InboxRouteParams>();
  const selectedConversationId = readSelectedConversationId(routeParams);
  const search = useSearchParams().get(SEARCH_QUERY_PARAM) ?? "";
  const conversationsQuery = useConversations(search);
  const isConversationOpen = selectedConversationId !== null;

  useMarkOpenConversationRead({
    selectedConversationId,
    conversations: conversationsQuery.data,
    markConversationRead: actions.markConversationRead,
  });

  return (
    <div className={FRAME_CLASS_NAME}>
      <div className={PANES_CLASS_NAME}>
        <section aria-labelledby="inbox-title" className={cn(LIST_PANE_CLASS_NAME, isConversationOpen ? "hidden" : "flex")}>
          <InboxTitle />
          <div className="min-h-0 flex-1">
            <Suspense fallback={<ListPlaceholderRows />}>
              <ConversationList selectedConversationId={selectedConversationId} />
            </Suspense>
          </div>
        </section>
        <div className={cn(THREAD_PANE_CLASS_NAME, isConversationOpen ? "flex" : "hidden")}>
          {selectedConversationId === null ? (
            <NoConversationSelected />
          ) : (
            <ThreadPane
              conversationId={selectedConversationId}
              backHref={buildListHref(search)}
              sendReply={actions.sendReply}
            />
          )}
        </div>
      </div>
      <ReconnectingNotice isReconnecting={isReconnecting} />
    </div>
  );
}

/** Same frame as {@link InboxScreen}, shown while the URL is not known yet (first load). */
export function InboxScreenSkeleton(): React.ReactElement {
  return (
    <div className={FRAME_CLASS_NAME} aria-hidden="true">
      <div className={PANES_CLASS_NAME}>
        <div className={cn(LIST_PANE_CLASS_NAME, "flex")}>
          <div className="px-4 pt-5 pb-3">
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="border-b border-border p-3">
            <Skeleton className="h-9 w-full" />
          </div>
          <ListPlaceholderRows />
        </div>
        <div className={cn(THREAD_PANE_CLASS_NAME, "hidden")} />
      </div>
    </div>
  );
}

/** The thread of the open conversation, with its composer and the replies still being sent. */
function ThreadPane({
  conversationId,
  backHref,
  sendReply,
}: {
  conversationId: string;
  backHref: string;
  sendReply: SendReplyAction;
}): React.ReactElement {
  const conversationQuery = useConversation(conversationId);
  const pendingMessages = usePendingReplies(conversationId);

  // The composer needs the 24h window, so it waits for the conversation's data.
  let composer: React.ReactNode = null;
  if (conversationQuery.data !== undefined) {
    composer = (
      <ReplyComposer
        key={conversationId}
        conversationId={conversationId}
        lastInboundAt={conversationQuery.data.lastInboundAt}
        sendReply={sendReply}
      />
    );
  }

  return (
    <ConversationThread
      conversationId={conversationId}
      backHref={backHref}
      composer={composer}
      pendingMessages={pendingMessages}
    />
  );
}

/**
 * Clears the unread counter of the open conversation (AC-3.3, AC-3.4): when
 * it is opened, and again each time a new customer message arrives while it
 * stays open. The list data is the trigger, because the live updates refetch
 * it on every new message.
 *
 * The "unread state" (id + count + time of the latest activity) that was
 * already marked is remembered, so a re-render or a refetch with the same
 * data does not call the action again; a new message changes the time, so it
 * is marked even when the count is the same as before.
 */
function useMarkOpenConversationRead({
  selectedConversationId,
  conversations,
  markConversationRead,
}: {
  selectedConversationId: string | null;
  conversations: ConversationSummary[] | undefined;
  markConversationRead: MarkConversationReadAction;
}): void {
  const queryClient = useQueryClient();
  const lastMarkedUnreadStateRef = useRef<string | null>(null);

  const openConversation = conversations?.find((conversation) => conversation.id === selectedConversationId);
  const unreadState = describeUnreadState(openConversation);

  useEffect(() => {
    if (openConversation === undefined || unreadState === null) {
      return;
    }
    if (unreadState === lastMarkedUnreadStateRef.current) {
      return;
    }
    lastMarkedUnreadStateRef.current = unreadState;

    const conversationId = openConversation.id;
    markConversationRead(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEYS.conversations }))
      .catch((error: unknown) => {
        // Forget it, so the next refetch tries again; the badge simply stays until then.
        lastMarkedUnreadStateRef.current = null;
        console.error("Could not mark the conversation as read:", error);
      });
  }, [openConversation, unreadState, markConversationRead, queryClient]);
}

/** A text that changes whenever the conversation gets new unread messages; null when nothing is unread. */
function describeUnreadState(conversation: ConversationSummary | undefined): string | null {
  if (conversation === undefined || conversation.unreadCount === 0) {
    return null;
  }
  return `${conversation.id}:${conversation.unreadCount}:${conversation.lastActivityAt.getTime()}`;
}

/** Visible page title, like the other pages; only in the list pane, which is the page on mobile. */
function InboxTitle(): React.ReactElement {
  return (
    <h1 id="inbox-title" className="px-4 pt-5 pb-3 text-page font-semibold tracking-tight text-title">
      {INBOX_TITLE}
    </h1>
  );
}

/** Desktop right pane when no conversation is open. */
function NoConversationSelected(): React.ReactElement {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState icon={MessagesSquare} title={NO_CONVERSATION_SELECTED_MESSAGE} className="items-center text-center" />
    </div>
  );
}

/**
 * Discreet Slate pill over the top of the inbox while the live connection is
 * down (AC-7.2). The `role="status"` element is always mounted, so screen
 * readers announce the text when it appears.
 */
function ReconnectingNotice({ isReconnecting }: { isReconnecting: boolean }): React.ReactElement {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-4 md:left-[340px]"
    >
      {isReconnecting && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-inactive px-3 py-1 text-meta font-medium text-status-inactive-foreground">
          <WifiOff aria-hidden="true" className="size-3.5" />
          {RECONNECTING_MESSAGE}
        </span>
      )}
    </div>
  );
}

/** Grey rows in the shape of the real list rows: avatar, name + time, preview. */
function ListPlaceholderRows(): React.ReactElement {
  const rowNumbers = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => index);

  return (
    <div aria-hidden="true">
      {rowNumbers.map((rowNumber) => (
        <div key={rowNumber} className="flex gap-3 border-b border-border px-4 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2 py-0.5">
            <Skeleton className="h-4 w-2/5 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-4/5 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The open conversation from the URL: none at `/inbox`, the segment at
 * `/inbox/<id>`. A deeper path (`/inbox/a/b`) is passed on joined, so the
 * thread answers "Esta conversación no existe" instead of opening `a`.
 */
function readSelectedConversationId({ conversationId }: InboxRouteParams): string | null {
  if (conversationId === undefined || conversationId.length === 0) {
    return null;
  }
  return conversationId.join("/");
}

/** "Volver" goes back to the list with the same search (`/inbox?q=…`). */
function buildListHref(search: string): string {
  if (search === "") {
    return INBOX_PATH;
  }
  const parameters = new URLSearchParams({ [SEARCH_QUERY_PARAM]: search });
  return `${INBOX_PATH}?${parameters.toString()}`;
}
