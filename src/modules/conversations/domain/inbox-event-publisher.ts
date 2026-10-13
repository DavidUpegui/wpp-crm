/**
 * A small realtime signal (ids + type only, AGENTS.md §10); open inbox screens
 * refetch the data when they receive it.
 */
export type InboxEvent = { type: "conversation_updated"; conversationId: string };

/**
 * Tells open inbox screens that something changed (FR-020), e.g. a new message
 * or a status update. Throws no domain errors; delivery failures propagate.
 */
export interface InboxEventPublisher {
  publish(event: InboxEvent): Promise<void>;
}
