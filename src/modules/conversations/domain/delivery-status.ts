// Monotonic delivery status (BR-003, AGENTS.md §8.7): Meta's status webhooks can
// arrive out of order, so a status may only move forward and "failed" is final.

import type { DeliveryStatus } from "./message";
import type { MessageStatusReport } from "./message-status-report";

type ReportedStatus = MessageStatusReport["status"];

// Position of each non-final status; a higher rank is further along.
const DELIVERY_STATUS_RANK: Record<Exclude<DeliveryStatus, "failed">, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/**
 * Returns the status a message should have after Meta reports `reported`.
 * Never moves backwards; "failed" can be applied from any status and is final;
 * "played" (voice messages) counts as "read".
 */
export function nextDeliveryStatus(
  current: DeliveryStatus,
  reported: ReportedStatus,
): DeliveryStatus {
  if (current === "failed") {
    return current;
  }

  const reportedStatus = toDeliveryStatus(reported);
  if (reportedStatus === "failed") {
    return reportedStatus;
  }

  if (DELIVERY_STATUS_RANK[reportedStatus] > DELIVERY_STATUS_RANK[current]) {
    return reportedStatus;
  }
  return current;
}

function toDeliveryStatus(reported: ReportedStatus): DeliveryStatus {
  if (reported === "played") {
    return "read";
  }
  return reported;
}
