"use client";

import { MessagesSquare, SearchX, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationSummary } from "@/modules/conversations/domain/inbox-views";
import { ConversationListItem } from "@/modules/conversations/ui/conversation-list-item";
import { ConversationSearch } from "@/modules/conversations/ui/conversation-search";
import { useConversations } from "@/modules/conversations/ui/inbox-queries";
import {
  CONVERSATIONS_LOAD_ERROR_MESSAGE,
  formatNoSearchResultsMessage,
  LOADING_LABEL,
  NO_CONVERSATIONS_MESSAGE,
  RETRY_LABEL,
} from "@/modules/conversations/ui/messages";

/** URL query parameter that keeps the search (FR-012), so reloads and links keep it. */
const SEARCH_QUERY_PARAM = "q";

/** Wait this long after the last keystroke before searching, so typing does not fire a request per letter. */
const SEARCH_DEBOUNCE_MS = 250;

/** Placeholder rows shown while the list loads (spec §10). */
const PLACEHOLDER_ROW_COUNT = 6;

const INBOX_PATH = "/inbox";

/** Accessible name of the list, since the pane has no visible heading of its own. */
const LIST_LABEL = "Conversaciones";

/** Props of {@link ConversationList}. */
export interface ConversationListProps {
  /** The conversation open in the thread pane, highlighted in the list; null when none is open. */
  selectedConversationId: string | null;
}

/**
 * Left pane of the inbox (FR-011, FR-012, AC-3.1, AC-3.2): the search box and
 * the conversations, newest activity first (the server already sorts them).
 *
 * The search lives in `?q=`: typing updates the box at once, and after a short
 * pause the URL. The URL is what the list is filtered by, so a reload, the
 * back button or a shared link show the same search.
 */
export function ConversationList({ selectedConversationId }: ConversationListProps): React.ReactElement {
  const appliedSearch = useSearchParams().get(SEARCH_QUERY_PARAM) ?? "";
  const searchText = useSearchTextSyncedWithUrl(appliedSearch);
  const conversationsQuery = useConversations(appliedSearch);

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-border p-3">
        <ConversationSearch value={searchText.value} onChange={searchText.setValue} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationListBody
          conversations={conversationsQuery.data}
          isPending={conversationsQuery.isPending}
          onRetry={() => void conversationsQuery.refetch()}
          search={appliedSearch}
          selectedConversationId={selectedConversationId}
        />
      </div>
    </div>
  );
}

type ConversationListBodyProps = {
  /** Undefined while loading or when the first load failed. */
  conversations: ConversationSummary[] | undefined;
  isPending: boolean;
  onRetry: () => void;
  search: string;
  selectedConversationId: string | null;
};

/** Picks one of the spec §10 states: loading, error, empty, no results or the rows. */
function ConversationListBody({
  conversations,
  isPending,
  onRetry,
  search,
  selectedConversationId,
}: ConversationListBodyProps): React.ReactElement {
  if (isPending) {
    return <PlaceholderRows />;
  }
  // A failed refresh keeps the rows already loaded; the error shows only when there is nothing to show.
  if (conversations === undefined) {
    return <LoadError onRetry={onRetry} />;
  }
  if (conversations.length === 0 && search === "") {
    return <ListNotice icon={MessagesSquare} text={NO_CONVERSATIONS_MESSAGE} />;
  }
  if (conversations.length === 0) {
    return <ListNotice icon={SearchX} text={formatNoSearchResultsMessage(search)} />;
  }

  return (
    <ul aria-label={LIST_LABEL}>
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <ConversationListItem
            conversation={conversation}
            href={buildConversationHref(conversation.id, search)}
            isSelected={conversation.id === selectedConversationId}
          />
        </li>
      ))}
    </ul>
  );
}

/** Grey shapes in the layout of a real row: avatar, name + time, preview. */
function PlaceholderRows(): React.ReactElement {
  const rowNumbers = Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_, index) => index);

  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        {LOADING_LABEL}
      </span>
      {rowNumbers.map((rowNumber) => (
        <div key={rowNumber} aria-hidden="true" className="flex gap-3 border-b border-border px-4 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2 py-0.5">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-2/5 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-10 motion-reduce:animate-none" />
            </div>
            <Skeleton className="h-3 w-4/5 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-4 py-6">
      <p className="text-body text-foreground">{CONVERSATIONS_LOAD_ERROR_MESSAGE}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {RETRY_LABEL}
      </Button>
    </div>
  );
}

/** Quiet, left-aligned message for the empty and no-results states. */
function ListNotice({ icon: Icon, text }: { icon: LucideIcon; text: string }): React.ReactElement {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="text-body text-muted-foreground">{text}</p>
    </div>
  );
}

/**
 * Keeps the text in the search box and the `?q=` of the URL in step:
 * typing writes the URL after {@link SEARCH_DEBOUNCE_MS}; a URL change from
 * outside (back button, a link) replaces what the box shows.
 */
function useSearchTextSyncedWithUrl(appliedSearch: string): { value: string; setValue: (value: string) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchText, setSearchText] = useState(appliedSearch);
  const [previousAppliedSearch, setPreviousAppliedSearch] = useState(appliedSearch);

  // Our own URL update stores the trimmed text: do not overwrite the box then,
  // or a space typed between two words would disappear.
  if (appliedSearch !== previousAppliedSearch) {
    setPreviousAppliedSearch(appliedSearch);
    if (appliedSearch !== searchText.trim()) {
      setSearchText(appliedSearch);
    }
  }

  useEffect(() => {
    const trimmedSearch = searchText.trim();
    if (trimmedSearch === appliedSearch) {
      return;
    }
    const timeoutId = setTimeout(() => {
      router.replace(buildUrlWithSearch(pathname, searchParams, trimmedSearch), { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [searchText, appliedSearch, router, pathname, searchParams]);

  return { value: searchText, setValue: setSearchText };
}

/** Same path and other parameters, with `?q=` set to the search (or removed when empty). */
function buildUrlWithSearch(pathname: string, searchParams: URLSearchParams, search: string): string {
  const nextParams = new URLSearchParams(searchParams.toString());
  if (search === "") {
    nextParams.delete(SEARCH_QUERY_PARAM);
  } else {
    nextParams.set(SEARCH_QUERY_PARAM, search);
  }
  return withQueryString(pathname, nextParams);
}

/** `/inbox/<id>`, keeping the search so the list stays filtered after opening a conversation. */
function buildConversationHref(conversationId: string, search: string): string {
  const parameters = new URLSearchParams();
  if (search !== "") {
    parameters.set(SEARCH_QUERY_PARAM, search);
  }
  return withQueryString(`${INBOX_PATH}/${encodeURIComponent(conversationId)}`, parameters);
}

function withQueryString(path: string, parameters: URLSearchParams): string {
  const queryString = parameters.toString();
  if (queryString === "") {
    return path;
  }
  return `${path}?${queryString}`;
}
