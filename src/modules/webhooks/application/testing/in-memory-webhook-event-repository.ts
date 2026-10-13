// TEST-ONLY fake. Never import this file from production code.

import { WebhookEventNotFoundError } from "@/modules/webhooks/domain/errors";
import type {
  NewWebhookEvent,
  WebhookEventRepository,
} from "@/modules/webhooks/domain/webhook-event-repository";

/** One stored webhook event, as the fake keeps it. */
export type StoredWebhookEvent = NewWebhookEvent & {
  id: string;
  processed: boolean;
  errorDescription: string | null;
};

/**
 * Keeps webhook events in memory so use case tests run without a database.
 * Mirrors `DrizzleWebhookEventRepository`: marking an unknown id throws.
 */
export class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly events: StoredWebhookEvent[] = [];

  async save(event: NewWebhookEvent): Promise<string> {
    const id = `webhook-event-${this.events.length + 1}`;
    this.events.push({ ...event, id, processed: false, errorDescription: null });
    return id;
  }

  async markProcessed(id: string): Promise<void> {
    const event = this.getById(id);
    event.processed = true;
    event.errorDescription = null;
  }

  async markFailed(id: string, errorDescription: string): Promise<void> {
    const event = this.getById(id);
    event.processed = false;
    event.errorDescription = errorDescription;
  }

  private getById(id: string): StoredWebhookEvent {
    const event = this.events.find((storedEvent) => storedEvent.id === id);
    if (!event) {
      throw new WebhookEventNotFoundError();
    }
    return event;
  }
}
