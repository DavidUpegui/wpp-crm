import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { PostgresInboxEventPublisher } from "@/modules/conversations/infrastructure/postgres-inbox-event-publisher";
import { INBOX_EVENTS_CHANNEL } from "@/shared/realtime/inbox-events-channel";
import { notify } from "@/shared/realtime/notify";
import { subscribeToChannel } from "@/shared/realtime/subscribe-to-channel";
import { createTestDatabase } from "../../../tests/integration/test-database";

const WAIT_FOR_EVENT_TIMEOUT_MS = 2_000;
const QUIET_PERIOD_MS = 300;

const testDatabase = createTestDatabase();
const publisher = new PostgresInboxEventPublisher(testDatabase.database);

afterAll(async () => {
  await testDatabase.close();
});

function readConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set: run with the integration config.");
  }
  return connectionString;
}

function waitFor(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (Date.now() - startedAt > WAIT_FOR_EVENT_TIMEOUT_MS) {
        clearInterval(interval);
        reject(new Error("Timed out waiting for a realtime event."));
      }
    }, 20);
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("realtime NOTIFY/LISTEN", () => {
  it("delivers the JSON published by PostgresInboxEventPublisher to a subscriber", async () => {
    const received: unknown[] = [];
    const unsubscribe = await subscribeToChannel(
      readConnectionString(),
      INBOX_EVENTS_CHANNEL,
      (payload) => received.push(payload),
    );

    try {
      await publisher.publish({ type: "conversation_updated", conversationId: "conversation-1" });
      await waitFor(() => received.length === 1);

      expect(received).toEqual([{ type: "conversation_updated", conversationId: "conversation-1" }]);
    } finally {
      await unsubscribe();
    }
  });

  it("ignores malformed payloads without throwing", async () => {
    const received: unknown[] = [];
    const unsubscribe = await subscribeToChannel(
      readConnectionString(),
      INBOX_EVENTS_CHANNEL,
      (payload) => received.push(payload),
    );

    try {
      // `notify` always sends JSON, so send a raw non-JSON string through pg_notify directly.
      await testDatabase.database.execute(
        sql`select pg_notify(${INBOX_EVENTS_CHANNEL}, ${"not json {"})`,
      );
      await notify(testDatabase.database, INBOX_EVENTS_CHANNEL, { type: "after_malformed" });
      await waitFor(() => received.length === 1);

      expect(received).toEqual([{ type: "after_malformed" }]);
    } finally {
      await unsubscribe();
    }
  });

  it("stops delivering events and closes the client after unsubscribe", async () => {
    const received: unknown[] = [];
    const unsubscribe = await subscribeToChannel(
      readConnectionString(),
      INBOX_EVENTS_CHANNEL,
      (payload) => received.push(payload),
    );

    await unsubscribe();
    await publisher.publish({ type: "conversation_updated", conversationId: "conversation-2" });
    await sleep(QUIET_PERIOD_MS);

    expect(received).toEqual([]);
    // A second unsubscribe fails because the pg client is already closed.
    await expect(unsubscribe()).rejects.toThrow();
  });
});
