import { isNewerActivity } from "@/modules/conversations/domain/conversation-activity";
import type { Conversation } from "@/modules/conversations/domain/conversation";
import type { ConversationTransactionRunner } from "@/modules/conversations/domain/conversation-transaction-runner";
import type { InboundMessageInput } from "@/modules/conversations/domain/inbound-message-input";
import type { InboxEventPublisher } from "@/modules/conversations/domain/inbox-event-publisher";
import type { Message } from "@/modules/conversations/domain/message";
import { normalizeSearchText } from "@/modules/conversations/domain/search-text";

/** The interfaces `recordInboundMessage` needs; the container passes the real ones, tests pass fakes. */
export type RecordInboundMessageDependencies = {
  transactionRunner: ConversationTransactionRunner;
  inboxEventPublisher: InboxEventPublisher;
  /** Current time; used as the activity time of a brand-new conversation. */
  now: () => Date;
};

/**
 * Builds the use case that stores a customer message received by webhook
 * (FR-005–FR-007, FR-010, AC-2.1–AC-2.5).
 *
 * In one transaction it creates or refreshes the contact, gets or creates its
 * conversation and inserts the message. Meta can deliver the same webhook more
 * than once (BR-002), so a message whose `waMessageId` is already stored changes
 * nothing and publishes no event. A new message counts as unread and only
 * becomes the conversation preview when it is not older than the current one,
 * because webhooks can arrive out of order (BR-007).
 *
 * The realtime event is published after the transaction commits, so open
 * inbox screens never refetch data that is not saved yet.
 */
export function makeRecordInboundMessage(dependencies: RecordInboundMessageDependencies) {
  return async function recordInboundMessage(input: InboundMessageInput): Promise<void> {
    const updatedConversationId = await dependencies.transactionRunner.run(
      async ({ contacts, conversations, messages }) => {
        const contact = await contacts.upsertByWaId({
          waId: input.fromWaId,
          profileName: input.profileName,
          profileNameSearch: toProfileNameSearch(input.profileName),
        });
        const conversation = await conversations.findOrCreateForContact(
          contact.id,
          dependencies.now(),
        );

        const insertedMessage = await messages.insertInboundIfNew({
          conversationId: conversation.id,
          waMessageId: input.waMessageId,
          type: input.type,
          text: input.text,
          sentAt: input.sentAt,
        });
        if (insertedMessage === null) {
          return null;
        }

        await conversations.update(applyInboundMessage(conversation, insertedMessage));
        return conversation.id;
      },
    );

    if (updatedConversationId === null) {
      return;
    }
    await dependencies.inboxEventPublisher.publish({
      type: "conversation_updated",
      conversationId: updatedConversationId,
    });
  };
}

function toProfileNameSearch(profileName: string | null): string | null {
  if (profileName === null) {
    return null;
  }
  return normalizeSearchText(profileName);
}

/** Returns the conversation as it should be after receiving `message`. */
function applyInboundMessage(conversation: Conversation, message: Message): Conversation {
  const updatedConversation: Conversation = {
    ...conversation,
    lastInboundAt: latestDate(conversation.lastInboundAt, message.sentAt),
    unreadCount: conversation.unreadCount + 1,
  };

  if (isNewerActivity(message.sentAt, currentActivityAt(conversation))) {
    updatedConversation.lastActivityAt = message.sentAt;
    updatedConversation.lastMessageId = message.id;
  }
  return updatedConversation;
}

/**
 * A conversation without messages only has its creation time as activity; any
 * first message must replace it, even one WhatsApp dated a bit earlier.
 */
function currentActivityAt(conversation: Conversation): Date | null {
  if (conversation.lastMessageId === null) {
    return null;
  }
  return conversation.lastActivityAt;
}

function latestDate(current: Date | null, candidate: Date): Date {
  if (current === null || candidate.getTime() > current.getTime()) {
    return candidate;
  }
  return current;
}
