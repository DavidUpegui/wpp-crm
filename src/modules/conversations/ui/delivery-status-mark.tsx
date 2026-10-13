import { Check, CheckCheck, CircleAlert, Clock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DeliveryStatus } from "@/modules/conversations/domain/message";
import { DELIVERY_STATUS_LABELS } from "@/modules/conversations/ui/messages";

/** Icon and colour of each status (plan 002 §7b). A `Record` so a new status fails typecheck. */
const STATUS_APPEARANCE: Record<DeliveryStatus, { icon: LucideIcon; colorClassName: string }> = {
  queued: { icon: Clock, colorClassName: "text-muted-foreground" },
  sent: { icon: Check, colorClassName: "text-muted-foreground" },
  delivered: { icon: CheckCheck, colorClassName: "text-muted-foreground" },
  read: { icon: CheckCheck, colorClassName: "text-read-receipt" },
  failed: { icon: CircleAlert, colorClassName: "text-destructive" },
};

/** Props of {@link DeliveryStatusMark}. */
export interface DeliveryStatusMarkProps {
  status: DeliveryStatus;
}

/**
 * Delivery status of a team message (AC-6.1): an icon plus its Spanish label.
 * The label is always shown so the status never depends on colour alone; the
 * icon is decorative and hidden from screen readers.
 */
export function DeliveryStatusMark({ status }: DeliveryStatusMarkProps): React.ReactElement {
  const { icon: StatusIcon, colorClassName } = STATUS_APPEARANCE[status];

  return (
    <span className={cn("inline-flex items-center gap-1", colorClassName)}>
      <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {DELIVERY_STATUS_LABELS[status]}
    </span>
  );
}
