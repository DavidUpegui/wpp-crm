// All intentional errors of the webhooks module (each extends `AppError` with a
// stable `code`). Messages never contain tokens or payload content, because
// errors may be logged.

import { AppError } from "@/shared/errors/app-error";

/** Thrown when a webhook POST has a missing or wrong `X-Hub-Signature-256` header (FR-002, AC-1.3). */
export class InvalidWebhookSignatureError extends AppError {
  constructor() {
    super("INVALID_WEBHOOK_SIGNATURE", "The webhook signature is missing or invalid.");
  }
}

/** Thrown when Meta's subscription check (GET) has a wrong mode, token or no challenge (FR-001, AC-1.2). */
export class WebhookVerificationFailedError extends AppError {
  constructor() {
    super("WEBHOOK_VERIFICATION_FAILED", "The webhook verification request is not valid.");
  }
}

/** Thrown when a signed webhook body is not a Meta `whatsapp_business_account` envelope (FR-003). */
export class InvalidWebhookPayloadError extends AppError {
  constructor() {
    super("INVALID_WEBHOOK_PAYLOAD", "The webhook payload is not a valid WhatsApp Business Account envelope.");
  }
}

/**
 * Thrown when an inbound message has no `from` and no matching `contacts[].wa_id`.
 * Senders identified only by Meta's business-scoped user id are not supported yet
 * (spec 002, plan §11), so the event is stored with this error for a later replay.
 */
export class MissingSenderWaIdError extends AppError {
  constructor() {
    super("MISSING_SENDER_WA_ID", "The inbound message has no sender WhatsApp number.");
  }
}

/**
 * Thrown when updating a stored webhook event that does not exist. It means a
 * bug (we only update events we just inserted), so it has no HTTP status row.
 */
export class WebhookEventNotFoundError extends AppError {
  constructor() {
    super("WEBHOOK_EVENT_NOT_FOUND", "The stored webhook event does not exist.");
  }
}
