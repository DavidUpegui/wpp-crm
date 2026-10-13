/**
 * `/api/webhooks/whatsapp` — the callback URL saved in the Meta dashboard (FR-001–FR-004).
 *
 * Public endpoint: there is no session. GET is protected by the verify token
 * and POST by the `X-Hub-Signature-256` signature (AGENTS.md §8.3–§8.4, §12).
 *
 * `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`
 *   Meta's subscription check, sent when the callback URL is saved.
 *   200 `text/plain`: the `hub.challenge` value, echoed back (AC-1.1).
 *   403 `WEBHOOK_VERIFICATION_FAILED` (wrong mode or token, or no challenge, AC-1.2).
 *
 * `POST /api/webhooks/whatsapp`
 *   Body: a Meta `whatsapp_business_account` webhook payload (raw JSON).
 *   Every POST is stored raw in `webhook_event` before processing (FR-003).
 *   200: `{ "status": "ok" }`, also when processing failed — the error is saved
 *        on the event row so Meta does not retry and flood us (FR-004, AC-1.4).
 *   401 `INVALID_WEBHOOK_SIGNATURE` (missing or wrong signature, AC-1.3).
 *
 * Errors always have the shape `{ "error": { "code", "message" } }`.
 * The body is never logged: it contains message content and phone numbers.
 */
import { connection, type NextRequest } from "next/server";

import { receiveWebhook, verifyWebhookSubscription } from "@/server/container";
import { toErrorResponse } from "@/shared/http/json-error-response";

const SIGNATURE_HEADER = "x-hub-signature-256";

/** Answers Meta's subscription check by echoing the challenge. */
export async function GET(request: NextRequest): Promise<Response> {
  await connection();

  try {
    const searchParams = request.nextUrl.searchParams;
    const challenge = await verifyWebhookSubscription({
      mode: searchParams.get("hub.mode"),
      verifyToken: searchParams.get("hub.verify_token"),
      challenge: searchParams.get("hub.challenge"),
    });
    return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Stores and processes one webhook POST from Meta. */
export async function POST(request: NextRequest): Promise<Response> {
  await connection();

  try {
    // The signature is computed over the exact bytes Meta sent, so the raw
    // text is read before anything parses it.
    const rawBody = await request.text();
    const signatureHeader = request.headers.get(SIGNATURE_HEADER);

    await receiveWebhook({ rawBody, signatureHeader });
    return Response.json({ status: "ok" });
  } catch (error) {
    return toErrorResponse(error);
  }
}
