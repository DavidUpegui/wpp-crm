import { describe, expect, it, vi } from "vitest";

import { MessageSendFailedError } from "@/modules/conversations/domain/errors";
import { MetaMessageSender } from "@/modules/conversations/infrastructure/meta-message-sender";
import { GraphApiError } from "@/shared/whatsapp/graph-api-error";

const PHONE_NUMBER_ID = "1234567890";
const RECIPIENT_WA_ID = "573001234567";
const WA_MESSAGE_ID = "wamid.HBgLNTczMDAxMjM0NTY3FQIAERgSMDk";
const RECIPIENT_NOT_IN_ALLOWED_LIST_CODE = 131030;

function makeSender(post: (path: string, body: unknown) => Promise<unknown>): MetaMessageSender {
  return new MetaMessageSender({ post }, PHONE_NUMBER_ID);
}

function acceptedResponse(): unknown {
  return {
    messaging_product: "whatsapp",
    contacts: [{ input: RECIPIENT_WA_ID, wa_id: RECIPIENT_WA_ID }],
    messages: [{ id: WA_MESSAGE_ID }],
  };
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

describe("MetaMessageSender.sendText", () => {
  it("posts a text message without link preview to /{phone-number-id}/messages", async () => {
    const post = vi.fn().mockResolvedValue(acceptedResponse());

    await makeSender(post).sendText(RECIPIENT_WA_ID, "Hola, ¿cómo estás?");

    expect(post).toHaveBeenCalledWith(`/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: RECIPIENT_WA_ID,
      type: "text",
      text: { body: "Hola, ¿cómo estás?", preview_url: false },
    });
  });

  it("returns the first message id from Meta as waMessageId", async () => {
    const post = vi.fn().mockResolvedValue(acceptedResponse());

    const receipt = await makeSender(post).sendText(RECIPIENT_WA_ID, "Hola");

    expect(receipt).toEqual({ waMessageId: WA_MESSAGE_ID });
  });

  it("maps a Graph API error into MessageSendFailedError with Meta's error code", async () => {
    const post = vi.fn().mockRejectedValue(new GraphApiError(RECIPIENT_NOT_IN_ALLOWED_LIST_CODE, 400));

    const error = await catchError(makeSender(post).sendText(RECIPIENT_WA_ID, "Hola"));

    expect(error).toBeInstanceOf(MessageSendFailedError);
    expect((error as MessageSendFailedError).metaErrorCode).toBe(RECIPIENT_NOT_IN_ALLOWED_LIST_CODE);
  });

  it("maps a network failure (no Meta code) into MessageSendFailedError with a null code", async () => {
    const post = vi.fn().mockRejectedValue(new GraphApiError(null));

    const error = await catchError(makeSender(post).sendText(RECIPIENT_WA_ID, "Hola"));

    expect(error).toBeInstanceOf(MessageSendFailedError);
    expect((error as MessageSendFailedError).metaErrorCode).toBeNull();
  });

  it("fails with a null code when Meta's response has no message id", async () => {
    const post = vi.fn().mockResolvedValue({ messaging_product: "whatsapp", messages: [] });

    const error = await catchError(makeSender(post).sendText(RECIPIENT_WA_ID, "Hola"));

    expect(error).toBeInstanceOf(MessageSendFailedError);
    expect((error as MessageSendFailedError).metaErrorCode).toBeNull();
  });

  it("rethrows unexpected errors unchanged", async () => {
    const unexpectedError = new TypeError("boom");
    const post = vi.fn().mockRejectedValue(unexpectedError);

    const error = await catchError(makeSender(post).sendText(RECIPIENT_WA_ID, "Hola"));

    expect(error).toBe(unexpectedError);
  });
});
