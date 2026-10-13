import { describe, expect, it } from "vitest";

import type { Message } from "@/modules/conversations/domain/message";
import type { MessageRepository } from "@/modules/conversations/domain/message-repository";
import type { MessageStatusReport } from "@/modules/conversations/domain/message-status-report";

import { makeApplyMessageStatus } from "./apply-message-status";
import { InMemoryConversationStore } from "./testing/in-memory-conversation-store";
import { RecordingInboxEventPublisher } from "./testing/recording-inbox-event-publisher";

const CONVERSATION_ID = "conversation-1";
const WA_MESSAGE_ID = "wamid.OUTBOUND-1";
const RECIPIENT_NOT_ALLOWED_CODE = 131030;

/** Builds the use case over an in-memory store holding one outbound message already "sent". */
async function setUp() {
  const store = new InMemoryConversationStore();
  const queuedMessage = await store.messages.insertOutbound({
    conversationId: CONVERSATION_ID,
    type: "text",
    text: "Hola",
    sentAt: new Date("2026-10-12T10:00:00Z"),
    sentByUserId: "user-1",
  });
  await store.messages.update({ ...queuedMessage, waMessageId: WA_MESSAGE_ID, status: "sent" });

  const messageRepository = countingUpdates(store.messages);
  const inboxEventPublisher = new RecordingInboxEventPublisher();
  const applyMessageStatus = makeApplyMessageStatus({
    messageRepository: messageRepository.repository,
    inboxEventPublisher,
  });
  return { store, messageRepository, inboxEventPublisher, applyMessageStatus };
}

/** Wraps a repository so the test can tell whether anything was written. */
function countingUpdates(inner: MessageRepository) {
  const counter = { updateCount: 0 };
  const repository: MessageRepository = {
    insertInboundIfNew: (message) => inner.insertInboundIfNew(message),
    insertOutbound: (message) => inner.insertOutbound(message),
    findByWaMessageId: (waMessageId) => inner.findByWaMessageId(waMessageId),
    update: async (message: Message) => {
      counter.updateCount += 1;
      await inner.update(message);
    },
  };
  return { repository, counter };
}

function report(
  status: MessageStatusReport["status"],
  failureCode: number | null = null,
): MessageStatusReport {
  return { waMessageId: WA_MESSAGE_ID, status, failureCode };
}

function storedMessage(store: InMemoryConversationStore): Message {
  const [message] = store.allMessages();
  return message;
}

describe("applyMessageStatus", () => {
  it("moves a message forward from sent to delivered to read, publishing each change", async () => {
    const { store, inboxEventPublisher, applyMessageStatus } = await setUp();

    await applyMessageStatus(report("delivered"));
    expect(storedMessage(store).status).toBe("delivered");

    await applyMessageStatus(report("read"));
    expect(storedMessage(store).status).toBe("read");

    expect(inboxEventPublisher.events).toEqual([
      { type: "conversation_updated", conversationId: CONVERSATION_ID },
      { type: "conversation_updated", conversationId: CONVERSATION_ID },
    ]);
  });

  it("keeps a read message as read when a late delivered report arrives", async () => {
    const { store, inboxEventPublisher, applyMessageStatus } = await setUp();

    await applyMessageStatus(report("read"));
    await applyMessageStatus(report("delivered"));

    expect(storedMessage(store).status).toBe("read");
    expect(inboxEventPublisher.events).toHaveLength(1);
  });

  it("stores the failure reason on failed and ignores every later report", async () => {
    const { store, inboxEventPublisher, applyMessageStatus } = await setUp();

    await applyMessageStatus(report("failed", RECIPIENT_NOT_ALLOWED_CODE));
    await applyMessageStatus(report("read"));
    await applyMessageStatus(report("failed", null));

    expect(storedMessage(store).status).toBe("failed");
    expect(storedMessage(store).failureReason).toBe("recipient_not_allowed");
    expect(inboxEventPublisher.events).toHaveLength(1);
  });

  it("ignores reports for a wamid we do not know, without publishing", async () => {
    const { store, messageRepository, inboxEventPublisher, applyMessageStatus } = await setUp();

    await applyMessageStatus({ waMessageId: "wamid.UNKNOWN", status: "read", failureCode: null });

    expect(storedMessage(store).status).toBe("sent");
    expect(messageRepository.counter.updateCount).toBe(0);
    expect(inboxEventPublisher.events).toEqual([]);
  });

  it("writes nothing and publishes nothing when the status does not change", async () => {
    const { messageRepository, inboxEventPublisher, applyMessageStatus } = await setUp();

    await applyMessageStatus(report("sent"));

    expect(messageRepository.counter.updateCount).toBe(0);
    expect(inboxEventPublisher.events).toEqual([]);
  });
});
