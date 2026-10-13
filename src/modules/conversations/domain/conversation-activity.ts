// Latest-activity rule (AC-3.1, BR-007): webhooks can arrive out of order, so a
// late-arriving older message must not replace the conversation's latest
// activity time or its preview in the list.

/**
 * Tells whether a message at `candidate` should become the conversation's latest
 * activity. True when there is no activity yet. A message with the same time as
 * the current one also counts as newer (the most recently processed one wins),
 * because two messages in the same instant have no better tie-breaker.
 */
export function isNewerActivity(candidate: Date, current: Date | null): boolean {
  if (current === null) {
    return true;
  }
  return candidate.getTime() >= current.getTime();
}
