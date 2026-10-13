// TEST-ONLY fake. Never import this file from production code.

import { MessageSendFailedError } from "@/modules/conversations/domain/errors";
import type {
  MessageSender,
  SentMessageReceipt,
} from "@/modules/conversations/domain/message-sender";

const FAKE_WA_MESSAGE_ID_PREFIX = "wamid.fake-";

/** One `sendText` call the fake received. */
export type SentTextMessage = { toWaId: string; text: string };

/**
 * A `MessageSender` that never calls Meta. By default it accepts every message
 * and returns `wamid.fake-1`, `wamid.fake-2`, …; after `failWith(code)` it
 * throws `MessageSendFailedError(code)` like `MetaMessageSender` does.
 * Every call (also failed ones) is recorded in `sentMessages`.
 */
export class FakeMessageSender implements MessageSender {
  readonly sentMessages: SentTextMessage[] = [];
  private failure: { metaErrorCode: number | null } | null = null;
  private nextWaMessageNumber = 1;

  async sendText(toWaId: string, text: string): Promise<SentMessageReceipt> {
    this.sentMessages.push({ toWaId, text });

    if (this.failure) {
      throw new MessageSendFailedError(this.failure.metaErrorCode);
    }

    const waMessageId = `${FAKE_WA_MESSAGE_ID_PREFIX}${this.nextWaMessageNumber}`;
    this.nextWaMessageNumber += 1;
    return { waMessageId };
  }

  /** Makes every next `sendText` throw `MessageSendFailedError` with this Meta error code. */
  failWith(metaErrorCode: number | null): void {
    this.failure = { metaErrorCode };
  }
}
