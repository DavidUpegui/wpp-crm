import { toDeliveryFailureReason } from "@/modules/conversations/domain/delivery-failure-reason";
import { nextDeliveryStatus } from "@/modules/conversations/domain/delivery-status";
import type { InboxEventPublisher } from "@/modules/conversations/domain/inbox-event-publisher";
import type { DeliveryStatus, Message } from "@/modules/conversations/domain/message";
import type { MessageRepository } from "@/modules/conversations/domain/message-repository";
import type { MessageStatusReport } from "@/modules/conversations/domain/message-status-report";

/** The interfaces `applyMessageStatus` needs; the container passes the real ones, tests pass fakes. */
export type ApplyMessageStatusDependencies = {
  messageRepository: MessageRepository;
  inboxEventPublisher: InboxEventPublisher;
};

/**
 * Builds the use case that applies a delivery status reported by Meta to one of
 * our outbound messages (FR-019, AC-6.1–6.3).
 *
 * Meta's status webhooks can arrive out of order or more than once, so the new
 * status comes from `nextDeliveryStatus` (never backwards, "failed" is final,
 * BR-003). Reports for messages we do not know are ignored. When nothing
 * changes, nothing is saved and no event is published, so repeated webhooks are
 * harmless (AGENTS.md §8.6).
 */
export function makeApplyMessageStatus(dependencies: ApplyMessageStatusDependencies) {
  return async function applyMessageStatus(report: MessageStatusReport): Promise<void> {
    const message = await dependencies.messageRepository.findByWaMessageId(report.waMessageId);
    // An unknown wamid (or an inbound message, which has no status) is not ours to update.
    if (!message || message.status === null) {
      return;
    }

    const updatedMessage = buildUpdatedMessage(message, message.status, report);
    if (updatedMessage.status === message.status) {
      return;
    }

    await dependencies.messageRepository.update(updatedMessage);
    await dependencies.inboxEventPublisher.publish({
      type: "conversation_updated",
      conversationId: message.conversationId,
    });
  };
}

/** Returns the message with the status Meta's report moves it to (and the reason, if it just failed). */
function buildUpdatedMessage(
  message: Message,
  currentStatus: DeliveryStatus,
  report: MessageStatusReport,
): Message {
  const nextStatus = nextDeliveryStatus(currentStatus, report.status);
  if (nextStatus === "failed" && currentStatus !== "failed") {
    return { ...message, status: nextStatus, failureReason: toDeliveryFailureReason(report.failureCode) };
  }
  return { ...message, status: nextStatus };
}
