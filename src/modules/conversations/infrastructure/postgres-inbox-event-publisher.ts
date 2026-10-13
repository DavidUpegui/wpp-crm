import "server-only";

import type {
  InboxEvent,
  InboxEventPublisher,
} from "@/modules/conversations/domain/inbox-event-publisher";
import type { DatabaseExecutor } from "@/shared/db/database";
import { INBOX_EVENTS_CHANNEL } from "@/shared/realtime/inbox-events-channel";
import { notify } from "@/shared/realtime/notify";

/**
 * `InboxEventPublisher` backed by Postgres `NOTIFY` on the `inbox_events` channel
 * (FR-020, AGENTS.md §10). `/api/realtime` listens on that channel and forwards each
 * event to open inbox screens as SSE.
 */
export class PostgresInboxEventPublisher implements InboxEventPublisher {
  private readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async publish(event: InboxEvent): Promise<void> {
    await notify(this.database, INBOX_EVENTS_CHANNEL, event);
  }
}
