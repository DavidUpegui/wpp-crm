import "server-only";

import { eq } from "drizzle-orm";

import { WebhookEventNotFoundError } from "@/modules/webhooks/domain/errors";
import type {
  NewWebhookEvent,
  WebhookEventRepository,
} from "@/modules/webhooks/domain/webhook-event-repository";
import type { DatabaseExecutor } from "@/shared/db/database";
import { webhookEvent as webhookEventTable } from "@/shared/db/schema";

type WebhookEventChanges = Pick<
  typeof webhookEventTable.$inferInsert,
  "processedAt" | "processingError"
>;

/**
 * `WebhookEventRepository` backed by the `webhook_event` table (Drizzle + Postgres).
 * Every webhook POST is stored raw before processing so failed events can be replayed
 * (AGENTS.md §8.5, FR-003). It receives the database in the constructor and never
 * imports the global client.
 */
export class DrizzleWebhookEventRepository implements WebhookEventRepository {
  private readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async save(event: NewWebhookEvent): Promise<string> {
    const rows = await this.database
      .insert(webhookEventTable)
      .values({ rawBody: event.rawBody, signatureValid: event.signatureValid })
      .returning({ id: webhookEventTable.id });
    return rows[0].id;
  }

  async markProcessed(id: string): Promise<void> {
    await this.updateRow(id, { processedAt: new Date(), processingError: null });
  }

  async markFailed(id: string, errorDescription: string): Promise<void> {
    // `processed_at` stays null so the event can be found and replayed later.
    await this.updateRow(id, { processedAt: null, processingError: errorDescription });
  }

  /** Updates one event; throws when no row matched (same contract as the in-memory fake). */
  private async updateRow(id: string, changes: WebhookEventChanges): Promise<void> {
    const rows = await this.database
      .update(webhookEventTable)
      .set(changes)
      .where(eq(webhookEventTable.id, id))
      .returning({ id: webhookEventTable.id });

    if (!rows[0]) {
      throw new WebhookEventNotFoundError();
    }
  }
}
