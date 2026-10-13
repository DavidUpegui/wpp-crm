import type { Message } from "./message";

/** The contact data the inbox screens show next to a conversation. */
export interface InboxContact {
  waId: string;
  profileName: string | null;
}

/** The latest message of a conversation, as shown in the list row preview. */
export type LastMessagePreview = Pick<Message, "direction" | "type" | "text" | "status">;

/** One row of the conversation list (FR-011): who, latest preview, when and how many unread. */
export interface ConversationSummary {
  id: string;
  contact: InboxContact;
  lastMessage: LastMessagePreview | null;
  lastActivityAt: Date;
  unreadCount: number;
}

/** The header data of an open conversation (FR-013); `lastInboundAt` drives the 24h indicator. */
export interface ConversationDetail {
  id: string;
  contact: InboxContact;
  lastInboundAt: Date | null;
}

/** One message bubble in the thread (FR-014), with the name of the team member who sent it. */
export interface ThreadMessage
  extends Pick<
    Message,
    "id" | "direction" | "type" | "text" | "sentAt" | "status" | "failureReason"
  > {
  /** Name of the sending team member; null for inbound messages or deleted users. */
  senderName: string | null;
}

/** A page of thread messages (FR-014), loaded newest first and returned in chronological order. */
export interface MessagePage {
  /** Oldest first, so the UI can render them top to bottom. */
  messages: ThreadMessage[];
  /** True when older messages exist and "Cargar anteriores" should be shown. */
  hasOlder: boolean;
}
