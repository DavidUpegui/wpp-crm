// TEST-ONLY fake. Never import this file from production code.

import type {
  InboxEvent,
  InboxEventPublisher,
} from "@/modules/conversations/domain/inbox-event-publisher";

/** An `InboxEventPublisher` that only remembers what was published, so tests can assert on it. */
export class RecordingInboxEventPublisher implements InboxEventPublisher {
  readonly events: InboxEvent[] = [];

  async publish(event: InboxEvent): Promise<void> {
    this.events.push({ ...event });
  }
}
