import type { InboxQueries } from "@/modules/conversations/domain/inbox-queries";
import type { ConversationSummary } from "@/modules/conversations/domain/inbox-views";

/** The interfaces `listConversations` needs; the container passes the real ones, tests pass fakes. */
export type ListConversationsDependencies = {
  inboxQueries: InboxQueries;
};

/**
 * Builds the use case that lists the inbox conversations, most recent activity
 * first (FR-011), optionally filtered by contact name or number (FR-012).
 * An empty or whitespace-only search means "no filter".
 */
export function makeListConversations(dependencies: ListConversationsDependencies) {
  return async function listConversations(search: string | null): Promise<ConversationSummary[]> {
    return dependencies.inboxQueries.listConversations(toSearchFilter(search));
  };
}

/** Trims the search, and turns an empty one into null (no filter), as `InboxQueries` expects. */
function toSearchFilter(search: string | null): string | null {
  if (search === null) {
    return null;
  }
  const trimmedSearch = search.trim();
  if (trimmedSearch === "") {
    return null;
  }
  return trimmedSearch;
}
