import type { InboundMessageInput } from "@/modules/conversations/domain/inbound-message-input";
import type { MessageStatusReport } from "@/modules/conversations/domain/message-status-report";
import { MissingSenderWaIdError } from "@/modules/webhooks/domain/errors";
import { readInboundMessageContent } from "@/modules/webhooks/domain/inbound-message-content";
import {
  type MetaInboundMessage,
  type MetaMessagesChangeValue,
  type MetaMessageStatus,
  metaMessagesChangeValueSchema,
} from "@/modules/webhooks/domain/meta-webhook-payload";
import type { WebhookChangeHandler } from "@/modules/webhooks/domain/webhook-change-handler";

const MILLISECONDS_PER_SECOND = 1000;

type MetaContact = NonNullable<MetaMessagesChangeValue["contacts"]>[number];

/**
 * The actions this handler hands parsed data to. They are plain functions typed
 * with the conversations DOMAIN input types, so this module never imports the
 * conversations use cases (the container wires them).
 */
export type HandleMessagesChangeDependencies = {
  recordInboundMessage: (input: InboundMessageInput) => Promise<void>;
  applyMessageStatus: (report: MessageStatusReport) => Promise<void>;
  /** Only events for this phone number are processed (FR-009). */
  businessPhoneNumberId: string;
};

/**
 * Handles the "messages" webhook field: records each inbound customer message
 * (FR-007, FR-008) and applies each delivery status update (FR-019). Events for
 * another business phone number are ignored (FR-009). Invalid values throw, so
 * `receiveWebhook` saves the error on the stored event.
 */
export function makeHandleMessagesChange(
  dependencies: HandleMessagesChangeDependencies,
): WebhookChangeHandler {
  return async function handleMessagesChange(value: unknown): Promise<void> {
    const changeValue = metaMessagesChangeValueSchema.parse(value);

    if (changeValue.metadata.phone_number_id !== dependencies.businessPhoneNumberId) {
      return;
    }

    const contacts = changeValue.contacts ?? [];
    for (const message of changeValue.messages ?? []) {
      await dependencies.recordInboundMessage(toInboundMessageInput(message, contacts));
    }

    for (const status of changeValue.statuses ?? []) {
      await dependencies.applyMessageStatus(toMessageStatusReport(status));
    }
  };
}

function toInboundMessageInput(
  message: MetaInboundMessage,
  contacts: MetaContact[],
): InboundMessageInput {
  const fromWaId = findSenderWaId(message, contacts);
  const content = readInboundMessageContent(message);

  return {
    waMessageId: message.id,
    fromWaId,
    profileName: findSenderProfileName(fromWaId, contacts),
    type: content.type,
    text: content.text,
    sentAt: new Date(Number(message.timestamp) * MILLISECONDS_PER_SECOND),
  };
}

function findSenderWaId(message: MetaInboundMessage, contacts: MetaContact[]): string {
  if (message.from) {
    return message.from;
  }

  const contactWaId = findSenderContact(message, contacts)?.wa_id;
  if (!contactWaId) {
    throw new MissingSenderWaIdError();
  }

  return contactWaId;
}

// Without `from`, the matching contact is the one sharing the business-scoped user id.
function findSenderContact(
  message: MetaInboundMessage,
  contacts: MetaContact[],
): MetaContact | undefined {
  const contactWithSameUserId = contacts.find(
    (contact) => message.from_user_id !== undefined && contact.user_id === message.from_user_id,
  );
  if (contactWithSameUserId) {
    return contactWithSameUserId;
  }

  return contacts.length === 1 ? contacts[0] : undefined;
}

function findSenderProfileName(fromWaId: string, contacts: MetaContact[]): string | null {
  const matchingContact = contacts.find((contact) => contact.wa_id === fromWaId);
  if (matchingContact) {
    return matchingContact.profile?.name ?? null;
  }

  if (contacts.length === 1) {
    return contacts[0].profile?.name ?? null;
  }

  return null;
}

function toMessageStatusReport(status: MetaMessageStatus): MessageStatusReport {
  return {
    waMessageId: status.id,
    status: status.status,
    failureCode: status.errors?.[0]?.code ?? null,
  };
}
