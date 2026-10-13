import "server-only";

import { z } from "zod";

import { MessageSendFailedError } from "@/modules/conversations/domain/errors";
import type {
  MessageSender,
  SentMessageReceipt,
} from "@/modules/conversations/domain/message-sender";
import { GraphApiError } from "@/shared/whatsapp/graph-api-error";
import type { GraphClient } from "@/shared/whatsapp/graph-client";

/** Meta accepted the message when it returns at least one message id ("wamid"). */
const sendMessageResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

/**
 * Sends WhatsApp messages through the Meta Cloud API (FR-017).
 *
 * Why: keeps Meta's request/response format out of the use cases; they only
 * see `MessageSender` and `MessageSendFailedError`.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 */
export class MetaMessageSender implements MessageSender {
  private readonly graphClient: Pick<GraphClient, "post">;
  private readonly phoneNumberId: string;

  constructor(graphClient: Pick<GraphClient, "post">, phoneNumberId: string) {
    this.graphClient = graphClient;
    this.phoneNumberId = phoneNumberId;
  }

  /** Sends a free-form text; link previews are off so the text arrives exactly as typed. */
  async sendText(toWaId: string, text: string): Promise<SentMessageReceipt> {
    const responseBody = await this.postMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toWaId,
      type: "text",
      text: { body: text, preview_url: false },
    });

    const result = sendMessageResponseSchema.safeParse(responseBody);
    if (!result.success) {
      throw new MessageSendFailedError(null);
    }
    return { waMessageId: result.data.messages[0].id };
  }

  private async postMessage(body: unknown): Promise<unknown> {
    try {
      return await this.graphClient.post(`/${this.phoneNumberId}/messages`, body);
    } catch (error) {
      if (error instanceof GraphApiError) {
        throw new MessageSendFailedError(error.metaErrorCode);
      }
      throw error;
    }
  }
}
