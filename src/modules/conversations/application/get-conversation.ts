import { ConversationNotFoundError } from "@/modules/conversations/domain/errors";
import type { InboxQueries } from "@/modules/conversations/domain/inbox-queries";
import type { ConversationDetail } from "@/modules/conversations/domain/inbox-views";

/** The interfaces `getConversation` needs; the container passes the real ones, tests pass fakes. */
export type GetConversationDependencies = {
  inboxQueries: InboxQueries;
};

/**
 * Builds the use case that returns the header data of one conversation
 * (contact and `lastInboundAt` for the 24h indicator, FR-013, FR-018).
 * An unknown id fails with `ConversationNotFoundError` (AC-4.4), which the
 * route turns into a 404.
 */
export function makeGetConversation(dependencies: GetConversationDependencies) {
  return async function getConversation(conversationId: string): Promise<ConversationDetail> {
    const conversation = await dependencies.inboxQueries.getConversationDetail(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError();
    }
    return conversation;
  };
}
