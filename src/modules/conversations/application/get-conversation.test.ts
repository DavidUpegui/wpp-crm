import { describe, expect, it } from "vitest";

import { ConversationNotFoundError } from "@/modules/conversations/domain/errors";
import type { InboxQueries } from "@/modules/conversations/domain/inbox-queries";
import type { ConversationDetail } from "@/modules/conversations/domain/inbox-views";

import { makeGetConversation } from "./get-conversation";

const KNOWN_CONVERSATION: ConversationDetail = {
  id: "conversation-1",
  contact: { waId: "573001234567", profileName: "José" },
  lastInboundAt: new Date("2026-10-12T10:00:00Z"),
};

/** A tiny `InboxQueries` stub that only knows `KNOWN_CONVERSATION`. */
const inboxQueries: InboxQueries = {
  listConversations: async () => [],
  getConversationDetail: async (conversationId) =>
    conversationId === KNOWN_CONVERSATION.id ? KNOWN_CONVERSATION : null,
  listMessages: async () => ({ messages: [], hasOlder: false }),
};

describe("getConversation", () => {
  it("returns the detail of an existing conversation", async () => {
    const getConversation = makeGetConversation({ inboxQueries });

    await expect(getConversation(KNOWN_CONVERSATION.id)).resolves.toEqual(KNOWN_CONVERSATION);
  });

  it("throws ConversationNotFoundError when the id does not exist", async () => {
    const getConversation = makeGetConversation({ inboxQueries });

    await expect(getConversation("conversation-missing")).rejects.toBeInstanceOf(
      ConversationNotFoundError,
    );
  });
});
