import { describe, expect, it } from "vitest";

import type { ThreadMessage } from "@/modules/conversations/domain/inbox-views";
import { removeSavedPendingReplies } from "@/modules/conversations/ui/remove-saved-pending-replies";

function buildMessage(overrides: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: "message-1",
    direction: "outbound",
    type: "text",
    text: "Hola",
    sentAt: new Date("2026-10-12T10:00:00Z"),
    status: "queued",
    failureReason: null,
    senderName: "Ana",
    ...overrides,
  };
}

describe("removeSavedPendingReplies", () => {
  it("keeps pending replies that are not saved yet", () => {
    const pending = [buildMessage({ id: "pending-1", senderName: null })];

    expect(removeSavedPendingReplies(pending, [])).toEqual(pending);
  });

  it("drops a pending reply once the thread has the saved queued reply with the same text", () => {
    const pending = [buildMessage({ id: "pending-1", senderName: null })];
    const saved = [buildMessage({ id: "saved-1" })];

    expect(removeSavedPendingReplies(pending, saved)).toEqual([]);
  });

  it("cancels only one pending reply per saved message when the same text is sent twice", () => {
    const pending = [
      buildMessage({ id: "pending-1", senderName: null }),
      buildMessage({ id: "pending-2", senderName: null }),
    ];
    const saved = [buildMessage({ id: "saved-1" })];

    expect(removeSavedPendingReplies(pending, saved).map((message) => message.id)).toEqual(["pending-2"]);
  });

  it("drops a pending reply when the saved reply is already sent", () => {
    const pending = [buildMessage({ id: "pending-1", senderName: null })];
    const saved = [buildMessage({ id: "saved-1", status: "sent" })];

    expect(removeSavedPendingReplies(pending, saved)).toEqual([]);
  });

  it("ignores customer messages with the same text", () => {
    const pending = [buildMessage({ id: "pending-1", senderName: null })];
    const saved = [buildMessage({ id: "inbound-1", direction: "inbound", status: null })];

    expect(removeSavedPendingReplies(pending, saved)).toEqual(pending);
  });

  it("ignores an older team reply with the same text", () => {
    const pending = [buildMessage({ id: "pending-1", senderName: null })];
    const saved = [
      buildMessage({ id: "yesterday-1", status: "read", sentAt: new Date("2026-10-11T10:00:00Z") }),
    ];

    expect(removeSavedPendingReplies(pending, saved)).toEqual(pending);
  });
});
