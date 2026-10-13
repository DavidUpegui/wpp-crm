/**
 * A delivery status update from Meta for one outbound message (FR-019).
 * `status` keeps Meta's values ("played" included); `nextDeliveryStatus` maps them.
 */
export interface MessageStatusReport {
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "played" | "failed";
  /** Meta error code when `status` is "failed"; null otherwise or when Meta sent none. */
  failureCode: number | null;
}
