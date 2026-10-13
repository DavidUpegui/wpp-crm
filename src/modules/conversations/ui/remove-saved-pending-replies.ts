import type { ThreadMessage } from "@/modules/conversations/domain/inbox-views";

/**
 * The browser and server clocks can differ a little; a saved reply this much
 * older than its pending bubble still counts as the same reply.
 */
const CLOCK_TOLERANCE_MS = 60_000;

/**
 * Drops the "Enviando" bubbles whose reply is already in the loaded thread (AC-5.1).
 *
 * Why: the server saves the reply and notifies the inbox BEFORE (and again
 * after) calling WhatsApp, so the live refetch can show the saved reply —
 * "Enviando" or already "Enviado" — while the sender's own pending bubble is
 * still on screen: the same reply twice.
 *
 * A saved team message with the same text, sent around or after the moment
 * the pending reply was submitted, cancels it. Each saved message cancels only
 * one pending reply, so two identical replies sent in a row still show twice.
 */
export function removeSavedPendingReplies(
  pendingReplies: ThreadMessage[],
  savedMessages: ThreadMessage[],
): ThreadMessage[] {
  const unmatchedSavedReplies = savedMessages.filter((message) => message.direction === "outbound");

  const unsavedReplies: ThreadMessage[] = [];
  for (const pendingReply of pendingReplies) {
    const index = unmatchedSavedReplies.findIndex((savedReply) => isSameReply(pendingReply, savedReply));
    if (index === -1) {
      unsavedReplies.push(pendingReply);
      continue;
    }
    // Each saved message cancels only one pending reply.
    unmatchedSavedReplies.splice(index, 1);
  }
  return unsavedReplies;
}

function isSameReply(pendingReply: ThreadMessage, savedReply: ThreadMessage): boolean {
  if (savedReply.text !== pendingReply.text) {
    return false;
  }
  const earliestMatchingTime = pendingReply.sentAt.getTime() - CLOCK_TOLERANCE_MS;
  return savedReply.sentAt.getTime() >= earliestMatchingTime;
}
