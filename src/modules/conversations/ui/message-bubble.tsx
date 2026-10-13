import { cn } from "@/lib/utils";
import type { ThreadMessage } from "@/modules/conversations/domain/inbox-views";
import { DeliveryStatusMark } from "@/modules/conversations/ui/delivery-status-mark";
import { FAILURE_REASON_MESSAGES } from "@/modules/conversations/ui/failure-reason-messages";
import {
  describeMessageContent,
  isUnsupportedMessage,
} from "@/modules/conversations/ui/message-content-label";
import { CUSTOMER_MESSAGE_PREFIX, TEAM_MESSAGE_PREFIX } from "@/modules/conversations/ui/messages";

// Spacing between bubbles (4px grouped / 12px on a change of side) is owned by
// the thread, which knows the previous message; this component only draws one
// message and its metadata line.

/** "10:41" — 24-hour clock, as Spanish-speaking users read times. */
const TIME_FORMATTER = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// `wrap-anywhere` (not `break-words`) so a long URL also shrinks the bubble on a phone instead of overflowing it.
const BUBBLE_BASE_CLASS_NAME =
  "max-w-[70ch] rounded-bubble border px-3.5 py-2 text-body whitespace-pre-wrap wrap-anywhere";

/** Paper with a hairline, tail corner (4px) bottom-left — the customer's side. */
const CUSTOMER_BUBBLE_CLASS_NAME = "border-border bg-bubble-customer rounded-bl-[4px]";

/** Mint wash, tail corner (4px) bottom-right — the team's side. */
const TEAM_BUBBLE_CLASS_NAME = "border-transparent bg-bubble-team rounded-br-[4px]";

/** Placeholder of a type we cannot show yet: reads as "something is here", not as text. */
const UNSUPPORTED_BUBBLE_CLASS_NAME = "border-dashed border-muted-foreground italic text-muted-foreground";

const METADATA_CLASS_NAME = "flex flex-wrap items-center gap-x-1.5 text-meta text-muted-foreground tabular-nums";

/** Props of {@link MessageBubble}. */
export interface MessageBubbleProps {
  message: ThreadMessage;
}

/**
 * One message of the thread (FR-014, AC-4.3). Customer messages sit on the
 * left; team messages on the right with who sent them, the time and the
 * delivery status (AC-6.1), plus the reason when WhatsApp refused it (AC-5.5).
 * Non-text messages show a Spanish placeholder (AC-2.4).
 */
export function MessageBubble({ message }: MessageBubbleProps): React.ReactElement {
  const isFromTeam = message.direction === "outbound";
  const isUnsupported = isUnsupportedMessage(message);

  return (
    <div className={cn("flex flex-col gap-1", isFromTeam ? "items-end" : "items-start")}>
      <p
        className={cn(
          BUBBLE_BASE_CLASS_NAME,
          isFromTeam ? TEAM_BUBBLE_CLASS_NAME : CUSTOMER_BUBBLE_CLASS_NAME,
          isUnsupported && UNSUPPORTED_BUBBLE_CLASS_NAME,
        )}
      >
        <span className="sr-only">{isFromTeam ? TEAM_MESSAGE_PREFIX : CUSTOMER_MESSAGE_PREFIX}</span>
        {describeMessageContent(message)}
      </p>
      {isFromTeam ? <TeamMessageMetadata message={message} /> : <MessageTime sentAt={message.sentAt} />}
    </div>
  );
}

/** "Laura · 10:41 · ✓✓ Leído", and the failure reason on its own line when not sent. */
function TeamMessageMetadata({ message }: MessageBubbleProps): React.ReactElement {
  const hasFailed = message.status === "failed";

  return (
    <div className="flex max-w-[70ch] flex-col items-end gap-0.5 text-right">
      <div className={cn(METADATA_CLASS_NAME, "justify-end")}>
        {message.senderName !== null && (
          <>
            <span>{message.senderName}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <MessageTime sentAt={message.sentAt} />
        {message.status !== null && (
          <>
            <span aria-hidden="true">·</span>
            <DeliveryStatusMark status={message.status} />
          </>
        )}
      </div>
      {hasFailed && (
        <p className="text-meta text-destructive">
          {FAILURE_REASON_MESSAGES[message.failureReason ?? "unknown"]}
        </p>
      )}
    </div>
  );
}

function MessageTime({ sentAt }: { sentAt: Date }): React.ReactElement {
  return (
    <time dateTime={sentAt.toISOString()} className="text-meta text-muted-foreground tabular-nums">
      {TIME_FORMATTER.format(sentAt)}
    </time>
  );
}
