import { InvalidWebhookPayloadError } from "@/modules/webhooks/domain/errors";
import { metaWebhookEnvelopeSchema } from "@/modules/webhooks/domain/meta-webhook-payload";
import type { WebhookChangeHandler } from "@/modules/webhooks/domain/webhook-change-handler";

/** What `processWebhookPayload` needs: one handler per webhook field it supports. */
export type ProcessWebhookPayloadDependencies = {
  /** Handler registry keyed by `changes[].field` (e.g. "messages"); AGENTS.md §5.3 O. */
  handlersByField: Record<string, WebhookChangeHandler>;
};

/** The function `makeProcessWebhookPayload` returns; `receiveWebhook` depends on this type. */
export type ProcessWebhookPayload = (payload: unknown) => Promise<void>;

/**
 * Builds the use case that reads a parsed Meta webhook body and sends every
 * `entry[].changes[]` item to the handler registered for its `field`.
 * Fields without a handler (e.g. `message_template_status_update`, handled in
 * a later spec) are skipped. A body that is not a WhatsApp Business Account
 * envelope throws `InvalidWebhookPayloadError` (FR-003).
 */
export function makeProcessWebhookPayload(
  dependencies: ProcessWebhookPayloadDependencies,
): ProcessWebhookPayload {
  return async function processWebhookPayload(payload: unknown): Promise<void> {
    const parsedEnvelope = metaWebhookEnvelopeSchema.safeParse(payload);
    if (!parsedEnvelope.success) {
      throw new InvalidWebhookPayloadError();
    }

    for (const entry of parsedEnvelope.data.entry) {
      for (const change of entry.changes) {
        const handler = findHandler(dependencies.handlersByField, change.field);
        if (!handler) {
          continue;
        }
        await handler(change.value);
      }
    }
  };
}

// `Object.hasOwn` avoids picking up inherited keys such as "constructor".
function findHandler(
  handlersByField: Record<string, WebhookChangeHandler>,
  field: string,
): WebhookChangeHandler | undefined {
  if (!Object.hasOwn(handlersByField, field)) {
    return undefined;
  }
  return handlersByField[field];
}
