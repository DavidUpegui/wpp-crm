import "server-only";

import { sql } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db/database";

/**
 * Sends a Postgres `NOTIFY` with a JSON payload so every `LISTEN`er on the channel
 * (e.g. the `/api/realtime` SSE stream) learns about a change. Uses `pg_notify(...)`
 * so channel and payload are query parameters, never concatenated SQL. Inside a
 * transaction, Postgres delivers the notification only after the commit.
 */
export async function notify(
  database: DatabaseExecutor,
  channel: string,
  payload: unknown,
): Promise<void> {
  await database.execute(sql`select pg_notify(${channel}, ${JSON.stringify(payload)})`);
}
