/**
 * Handles the `value` of one `entry[].changes[]` item of a Meta webhook, for
 * one `field` (e.g. "messages"). Handlers are registered by field name, so
 * supporting a new field means adding a handler, not editing a switch
 * (AGENTS.md §5.3 O). The value is `unknown`: each handler validates its own shape.
 */
export type WebhookChangeHandler = (value: unknown) => Promise<void>;
