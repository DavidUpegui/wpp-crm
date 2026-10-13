import type { InboxQueries } from "@/modules/conversations/domain/inbox-queries";
import type { MessagePage } from "@/modules/conversations/domain/inbox-views";

/** The interfaces `listConversationMessages` needs; the container passes the real ones, tests pass fakes. */
export type ListConversationMessagesDependencies = {
  inboxQueries: InboxQueries;
};

/**
 * Builds the use case that loads one page of a conversation's messages
 * (FR-013, FR-014): the newest ones when `beforeMessageId` is null, otherwise
 * the ones older than that message ("Cargar anteriores").
 */
export function makeListConversationMessages(dependencies: ListConversationMessagesDependencies) {
  return async function listConversationMessages(
    conversationId: string,
    beforeMessageId: string | null,
  ): Promise<MessagePage> {
    return dependencies.inboxQueries.listMessages(conversationId, beforeMessageId);
  };
}
