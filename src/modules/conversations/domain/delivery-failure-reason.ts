// Maps Meta's error codes to our own failure reasons (AC-5.5), so the UI can
// show a clear Spanish reason instead of a raw Meta code.
// https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

import type { DeliveryFailureReason } from "./message";

// Meta error code → our reason. Codes that are not listed map to "unknown".
const FAILURE_REASON_BY_META_ERROR_CODE: Record<number, DeliveryFailureReason> = {
  // Re-engagement message: more than 24h since the customer last wrote.
  131047: "outside_window",
  // Recipient not in the test number's allow-list. Provisional: this code is not
  // on Meta's error codes page; to be confirmed against the test number in T050.
  131030: "recipient_not_allowed",
  // Message undeliverable (e.g. the number has no WhatsApp).
  131026: "undeliverable",
  // Pair rate limit hit (too many messages to the same number).
  131056: "rate_limited",
  // Cloud API throughput limit reached.
  130429: "rate_limited",
  // Access token expired or invalid.
  190: "access_token_invalid",
};

/**
 * Returns the failure reason to store on a failed outbound message.
 * Any code we do not recognise, or no code at all, becomes "unknown".
 */
export function toDeliveryFailureReason(metaErrorCode: number | null): DeliveryFailureReason {
  if (metaErrorCode === null) {
    return "unknown";
  }
  return FAILURE_REASON_BY_META_ERROR_CODE[metaErrorCode] ?? "unknown";
}
