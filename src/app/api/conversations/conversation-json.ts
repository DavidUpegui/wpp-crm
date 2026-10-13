import type {
  ConversationDetail,
  ConversationSummary,
  InboxContact,
  LastMessagePreview,
  MessagePage,
  ThreadMessage,
} from "@/modules/conversations/domain/inbox-views";
import type { ThreadMessageJson } from "@/modules/conversations/ui/inbox-actions";
import type {
  ConversationDetailJson,
  ConversationSummaryJson,
  MessagePageJson,
} from "@/modules/conversations/ui/inbox-queries";

// The JSON types are declared in the UI module so the browser code can use them
// without importing from `src/app/` (AGENTS.md §5.1); re-exported for the routes.
export type { ConversationDetailJson, ConversationSummaryJson, MessagePageJson };

/**
 * Turns a conversation list row into its JSON shape.
 *
 * Why explicit fields: every inbox response lists what it sends, so nothing
 * internal leaks by accident, and dates always become ISO strings.
 */
export function toConversationSummaryJson(conversation: ConversationSummary): ConversationSummaryJson {
  return {
    id: conversation.id,
    contact: toContactJson(conversation.contact),
    lastMessage: toLastMessageJson(conversation.lastMessage),
    lastActivityAt: conversation.lastActivityAt.toISOString(),
    unreadCount: conversation.unreadCount,
  };
}

/** Turns the header data of one conversation into its JSON shape. */
export function toConversationDetailJson(conversation: ConversationDetail): ConversationDetailJson {
  return {
    id: conversation.id,
    contact: toContactJson(conversation.contact),
    lastInboundAt: conversation.lastInboundAt ? conversation.lastInboundAt.toISOString() : null,
  };
}

/** Turns a page of thread messages into its JSON shape. */
export function toMessagePageJson(page: MessagePage): MessagePageJson {
  return {
    messages: page.messages.map(toThreadMessageJson),
    hasOlder: page.hasOlder,
  };
}

/**
 * Turns one thread message into the shape the browser receives. Shared by the
 * messages route and `sendReplyAction`, so a sent reply looks exactly like a
 * loaded one.
 */
export function toThreadMessageJson(message: ThreadMessage): ThreadMessageJson {
  return {
    id: message.id,
    direction: message.direction,
    type: message.type,
    text: message.text,
    sentAt: message.sentAt.toISOString(),
    status: message.status,
    failureReason: message.failureReason,
    senderName: message.senderName,
  };
}

function toContactJson(contact: InboxContact): InboxContact {
  return { waId: contact.waId, profileName: contact.profileName };
}

function toLastMessageJson(lastMessage: LastMessagePreview | null): LastMessagePreview | null {
  if (!lastMessage) {
    return null;
  }
  return {
    direction: lastMessage.direction,
    type: lastMessage.type,
    text: lastMessage.text,
    status: lastMessage.status,
  };
}
