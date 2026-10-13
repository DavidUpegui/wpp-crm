import type { ProcessWebhookPayload } from "@/modules/webhooks/application/process-webhook-payload";
import { InvalidWebhookSignatureError } from "@/modules/webhooks/domain/errors";
import type { WebhookEventRepository } from "@/modules/webhooks/domain/webhook-event-repository";
import { hasValidWebhookSignature } from "@/modules/webhooks/domain/webhook-signature";

/** One webhook POST as the route handler received it. */
export type ReceiveWebhookInput = {
  /** The exact body text (`await request.text()`), needed for the signature check. */
  rawBody: string;
  /** The `X-Hub-Signature-256` header, or `null` when missing. */
  signatureHeader: string | null;
};

/** What `receiveWebhook` needs; the container passes the real ones, tests pass fakes. */
export type ReceiveWebhookDependencies = {
  webhookEventRepository: WebhookEventRepository;
  processWebhookPayload: ProcessWebhookPayload;
  /** `META_APP_SECRET`, the HMAC key of the signature. */
  appSecret: string;
};

/**
 * Builds the use case behind `POST /api/webhooks/whatsapp`. Every POST is
 * stored raw first (FR-003). A missing or wrong signature is stored flagged
 * as invalid, never processed, and throws `InvalidWebhookSignatureError` (401,
 * FR-002, AC-1.3). A signed POST is processed; if processing fails, the error
 * is saved on the row and NOT rethrown, because Meta must get a 200 or it
 * retries and floods us (FR-004, AC-1.4, AGENTS.md §8.5).
 * The body is never logged: it contains message content.
 */
export function makeReceiveWebhook(dependencies: ReceiveWebhookDependencies) {
  return async function receiveWebhook(input: ReceiveWebhookInput): Promise<void> {
    const signatureValid = hasValidWebhookSignature(
      input.rawBody,
      input.signatureHeader,
      dependencies.appSecret,
    );
    const webhookEventId = await dependencies.webhookEventRepository.save({
      rawBody: input.rawBody,
      signatureValid,
    });

    if (!signatureValid) {
      throw new InvalidWebhookSignatureError();
    }

    try {
      const payload: unknown = JSON.parse(input.rawBody);
      await dependencies.processWebhookPayload(payload);
    } catch (error) {
      await dependencies.webhookEventRepository.markFailed(webhookEventId, describeError(error));
      return;
    }
    await dependencies.webhookEventRepository.markProcessed(webhookEventId);
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
