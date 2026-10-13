import type { ConversationTransactionRunner } from "@/modules/conversations/domain/conversation-transaction-runner";
import { isWithinCustomerServiceWindow } from "@/modules/conversations/domain/customer-service-window";
import { toDeliveryFailureReason } from "@/modules/conversations/domain/delivery-failure-reason";
import {
  ConversationNotFoundError,
  MessageSendFailedError,
  OutsideCustomerServiceWindowError,
} from "@/modules/conversations/domain/errors";
import type { InboxEventPublisher } from "@/modules/conversations/domain/inbox-event-publisher";
import type { ThreadMessage } from "@/modules/conversations/domain/inbox-views";
import type { DeliveryFailureReason, Message } from "@/modules/conversations/domain/message";
import type { MessageSender } from "@/modules/conversations/domain/message-sender";
import { validateReplyText } from "@/modules/conversations/domain/reply-text";

const TEXT_MESSAGE_TYPE = "text";

/** The interfaces `sendTextReply` needs; the container passes the real ones, tests pass fakes. */
export type SendTextReplyDependencies = {
  transactionRunner: ConversationTransactionRunner;
  messageSender: MessageSender;
  inboxEventPublisher: InboxEventPublisher;
  now: () => Date;
};

/** A team member's free-form text reply to one conversation. */
export interface SendTextReplyInput {
  conversationId: string;
  text: string;
  senderUserId: string;
  /** Name of the sender, so the returned bubble can show it without another query. */
  senderName: string;
}

/** The queued reply, its validated text and the WhatsApp number it goes to. */
type QueuedReply = { message: Message; text: string; toWaId: string };

/**
 * Builds the use case that sends a text reply to a customer (FR-015–FR-017).
 *
 * The 24h window is checked here, before calling Meta, because outside it
 * WhatsApp only accepts templates (BR-001, AGENTS.md §8.2). The reply follows
 * the outbound flow of AGENTS.md §8.8: it is stored as "queued" first (so the
 * team sees it right away), then sent, then marked "sent" with Meta's wamid or
 * "failed" with a reason. A failed send is returned, not thrown, so the screen
 * can show the failed bubble with its reason (AC-5.5).
 *
 * Throws `EmptyReplyTextError` / `ReplyTextTooLongError` (nothing stored),
 * `ConversationNotFoundError` and `OutsideCustomerServiceWindowError`
 * (Meta is not called).
 */
export function makeSendTextReply(dependencies: SendTextReplyDependencies) {
  return async function sendTextReply(input: SendTextReplyInput): Promise<ThreadMessage> {
    const text = validateReplyText(input.text);

    const queuedReply = await storeQueuedReply(dependencies, input, text);
    await publishConversationUpdated(dependencies, input.conversationId);

    const finalMessage = await deliverReply(dependencies, queuedReply);
    await publishConversationUpdated(dependencies, input.conversationId);

    return toThreadMessage(finalMessage, input.senderName);
  };
}

async function storeQueuedReply(
  dependencies: SendTextReplyDependencies,
  input: SendTextReplyInput,
  text: string,
): Promise<QueuedReply> {
  return dependencies.transactionRunner.run(async (repositories) => {
    const now = dependencies.now();
    const conversation = await repositories.conversations.findById(input.conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    if (!isWithinCustomerServiceWindow(conversation.lastInboundAt, now)) {
      throw new OutsideCustomerServiceWindowError();
    }

    const contact = await repositories.contacts.findById(conversation.contactId);
    if (!contact) {
      throw new ConversationNotFoundError();
    }

    const message = await repositories.messages.insertOutbound({
      conversationId: conversation.id,
      type: TEXT_MESSAGE_TYPE,
      text,
      sentAt: now,
      sentByUserId: input.senderUserId,
    });
    await repositories.conversations.update({
      ...conversation,
      lastActivityAt: now,
      lastMessageId: message.id,
    });
    return { message, text, toWaId: contact.waId };
  });
}

// Calls Meta outside any transaction (a slow network call must not hold a
// database transaction open), then saves the outcome.
async function deliverReply(
  dependencies: SendTextReplyDependencies,
  queuedReply: QueuedReply,
): Promise<Message> {
  const finalMessage = await sendAndDescribeOutcome(dependencies, queuedReply);
  await dependencies.transactionRunner.run(async (repositories) => {
    await repositories.messages.update(finalMessage);
  });
  return finalMessage;
}

async function sendAndDescribeOutcome(
  dependencies: SendTextReplyDependencies,
  queuedReply: QueuedReply,
): Promise<Message> {
  const { message, text, toWaId } = queuedReply;
  try {
    const receipt = await dependencies.messageSender.sendText(toWaId, text);
    return { ...message, status: "sent", waMessageId: receipt.waMessageId };
  } catch (error) {
    // Any sender error becomes a failed bubble; its reason is kept on the message.
    return { ...message, status: "failed", failureReason: toFailureReason(error) };
  }
}

function toFailureReason(error: unknown): DeliveryFailureReason {
  if (error instanceof MessageSendFailedError) {
    return toDeliveryFailureReason(error.metaErrorCode);
  }
  return toDeliveryFailureReason(null);
}

async function publishConversationUpdated(
  dependencies: SendTextReplyDependencies,
  conversationId: string,
): Promise<void> {
  await dependencies.inboxEventPublisher.publish({
    type: "conversation_updated",
    conversationId,
  });
}

function toThreadMessage(message: Message, senderName: string): ThreadMessage {
  return {
    id: message.id,
    direction: message.direction,
    type: message.type,
    text: message.text,
    sentAt: message.sentAt,
    status: message.status,
    failureReason: message.failureReason,
    senderName,
  };
}
