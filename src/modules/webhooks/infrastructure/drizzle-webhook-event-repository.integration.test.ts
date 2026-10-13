// Integration tests for the Drizzle webhook event repository, against the real
// Postgres test database (`pnpm test:integration`).

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { WebhookEventNotFoundError } from "@/modules/webhooks/domain/errors";
import { webhookEvent as webhookEventTable } from "@/shared/db/schema";
import { createTestDatabase } from "../../../../tests/integration/test-database";

import { DrizzleWebhookEventRepository } from "./drizzle-webhook-event-repository";

const MISSING_EVENT_ID = "00000000-0000-0000-0000-000000000000";
const RAW_BODY = '{"object":"whatsapp_business_account","entry":[]}';

const testDatabase = createTestDatabase();
const webhookEvents = new DrizzleWebhookEventRepository(testDatabase.database);

beforeEach(async () => {
  await testDatabase.database.execute(sql`TRUNCATE "webhook_event"`);
});

afterAll(async () => {
  await testDatabase.close();
});

async function findStoredEvent(id: string): Promise<typeof webhookEventTable.$inferSelect> {
  const rows = await testDatabase.database
    .select()
    .from(webhookEventTable)
    .where(eq(webhookEventTable.id, id));
  return rows[0];
}

describe("DrizzleWebhookEventRepository", () => {
  it("stores the raw body and signature result, unprocessed", async () => {
    const id = await webhookEvents.save({ rawBody: RAW_BODY, signatureValid: false });

    const stored = await findStoredEvent(id);
    expect(stored.rawBody).toBe(RAW_BODY);
    expect(stored.signatureValid).toBe(false);
    expect(stored.receivedAt).toBeInstanceOf(Date);
    expect(stored.processedAt).toBeNull();
    expect(stored.processingError).toBeNull();
  });

  it("sets processed_at when the event is marked as processed", async () => {
    const id = await webhookEvents.save({ rawBody: RAW_BODY, signatureValid: true });

    await webhookEvents.markProcessed(id);

    const stored = await findStoredEvent(id);
    expect(stored.processedAt).toBeInstanceOf(Date);
    expect(stored.processingError).toBeNull();
  });

  it("keeps processed_at null and stores the error when the event is marked as failed", async () => {
    const id = await webhookEvents.save({ rawBody: RAW_BODY, signatureValid: true });

    await webhookEvents.markFailed(id, "Unexpected payload shape");

    const stored = await findStoredEvent(id);
    expect(stored.processedAt).toBeNull();
    expect(stored.processingError).toBe("Unexpected payload shape");
  });

  it("throws when marking an event that does not exist", async () => {
    await expect(webhookEvents.markProcessed(MISSING_EVENT_ID)).rejects.toThrow(WebhookEventNotFoundError);
    await expect(webhookEvents.markFailed(MISSING_EVENT_ID, "boom")).rejects.toThrow(WebhookEventNotFoundError);
  });
});
