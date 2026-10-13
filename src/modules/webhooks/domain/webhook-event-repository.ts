/** What is stored for every webhook POST before it is processed (AGENTS.md §8.5). */
export interface NewWebhookEvent {
  /** The exact body text received from Meta, before JSON parsing. */
  rawBody: string;
  /** Whether `X-Hub-Signature-256` matched; invalid rows are kept but never processed. */
  signatureValid: boolean;
}

/**
 * Persists every webhook POST raw ("store raw, then process") so failed
 * events can be inspected and replayed later (FR-003, FR-004).
 */
export interface WebhookEventRepository {
  /** Stores a received webhook and returns the id of the new row. */
  save(event: NewWebhookEvent): Promise<string>;
  /** Records that the event was processed without errors. */
  markProcessed(id: string): Promise<void>;
  /** Records why processing failed; the event stays unprocessed so it can be replayed. */
  markFailed(id: string, errorDescription: string): Promise<void>;
}
