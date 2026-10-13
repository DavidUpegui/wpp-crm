import type { ConversationRepository } from "@/modules/conversations/domain/conversation-repository";
import { ConversationNotFoundError } from "@/modules/conversations/domain/errors";
import type { InboxEventPublisher } from "@/modules/conversations/domain/inbox-event-publisher";

/** The interfaces `markConversationRead` needs; the container passes the real ones, tests pass fakes. */
export type MarkConversationReadDependencies = {
  conversationRepository: ConversationRepository;
  inboxEventPublisher: InboxEventPublisher;
};

/**
 * Builds the use case that clears a conversation's unread counter when a team
 * member opens it (FR-010, AC-3.3, AC-3.4). The counter is shared by the whole
 * team, so the change is published and every open inbox drops the badge.
 *
 * An unknown id fails with `ConversationNotFoundError`. A conversation that is
 * already read is left alone (no write, no event), because the screen calls
 * this every time the conversation is open.
 */
export function makeMarkConversationRead(dependencies: MarkConversationReadDependencies) {
  return async function markConversationRead(conversationId: string): Promise<void> {
    const conversation = await dependencies.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    if (conversation.unreadCount === 0) {
      return;
    }

    await dependencies.conversationRepository.update({ ...conversation, unreadCount: 0 });
    await dependencies.inboxEventPublisher.publish({
      type: "conversation_updated",
      conversationId: conversation.id,
    });
  };
}
