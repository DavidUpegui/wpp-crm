import "server-only";

import { Client, escapeIdentifier, type Notification } from "pg";

/** Stops listening and closes the dedicated connection. */
export type Unsubscribe = () => Promise<void>;

/**
 * Opens a dedicated `pg.Client` that runs `LISTEN <channel>` and calls `onPayload`
 * with each parsed JSON payload. One client per subscriber keeps the code simple
 * (plan §11: a handful of users). Malformed payloads are ignored; connection errors
 * are logged without the payload and never crash the process. `LISTEN` takes an
 * identifier (not a query parameter), so the channel name is quoted with
 * `escapeIdentifier`.
 */
export async function subscribeToChannel(
  connectionString: string,
  channel: string,
  onPayload: (payload: unknown) => void,
): Promise<Unsubscribe> {
  const listenTarget = escapeIdentifier(channel);
  const client = new Client({ connectionString });
  client.on("error", (error: Error) => {
    console.error(`Realtime listener on "${channel}" failed: ${error.message}`);
  });
  client.on("notification", (notification: Notification) => {
    if (notification.channel !== channel) {
      return;
    }
    deliverPayload(notification.payload, onPayload);
  });

  await client.connect();
  await client.query(`LISTEN ${listenTarget}`);

  return async function unsubscribe(): Promise<void> {
    try {
      await client.query(`UNLISTEN ${listenTarget}`);
    } finally {
      await client.end();
    }
  };
}

function deliverPayload(
  rawPayload: string | undefined,
  onPayload: (payload: unknown) => void,
): void {
  if (rawPayload === undefined) {
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    // A malformed payload is not ours (we always send JSON); skip it.
    return;
  }
  onPayload(payload);
}
