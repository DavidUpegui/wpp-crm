// The 24-hour customer service window (BR-001): free-form messages may only be
// sent while the customer's last message is less than 24 hours old.
// https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages

/** Length of Meta's customer service window: 24 hours in milliseconds. */
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Tells whether the team may send a free-form reply right now.
 * Closed when the customer never wrote, or wrote 24h or more ago.
 */
export function isWithinCustomerServiceWindow(lastInboundAt: Date | null, now: Date): boolean {
  if (lastInboundAt === null) {
    return false;
  }
  return now.getTime() < customerServiceWindowClosesAt(lastInboundAt).getTime();
}

/** The moment the window closes, so the UI can show until when a reply is possible. */
export function customerServiceWindowClosesAt(lastInboundAt: Date): Date {
  return new Date(lastInboundAt.getTime() + CUSTOMER_SERVICE_WINDOW_MS);
}
