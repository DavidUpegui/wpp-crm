"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/modules/conversations/domain/inbox-views";
import { describeMessageContent } from "@/modules/conversations/ui/message-content-label";

/** Words of the profile name used for the avatar ("Ana María Gómez" → "AM"). */
const MAX_INITIALS = 2;

/** Avatar text when the contact has no name: the last digits of the number. */
const FALLBACK_DIGITS_COUNT = 2;

/** Avatar text when there is neither a name nor a number to take letters from. */
const EMPTY_AVATAR_TEXT = "#";

/** "10:42" — 24-hour clock for messages from today. */
const TIME_FORMATTER = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "07/10" — day and month for older messages. */
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es", { day: "2-digit", month: "2-digit" });

const ROW_CLASS_NAME =
  "flex gap-3 border-b border-border px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/** Props of {@link ConversationListItem}. */
export interface ConversationListItemProps {
  conversation: ConversationSummary;
  /** Where the row leads: `/inbox/<id>`, keeping the search (`?q=`) if any. */
  href: string;
  isSelected: boolean;
}

/**
 * One row of the conversation list (FR-011, AC-2.1, AC-3.1): initials, name,
 * number, preview of the latest message, its time and the unread badge.
 * The row is a link so it works with the keyboard and middle-click. The open
 * conversation never shows a badge: it is being read (plan §7 "Unread while open").
 */
export function ConversationListItem({
  conversation,
  href,
  isSelected,
}: ConversationListItemProps): React.ReactElement {
  const { contact, lastMessage, lastActivityAt, unreadCount } = conversation;
  const phoneNumber = formatPhoneNumber(contact.waId);
  const hasProfileName = contact.profileName !== null && contact.profileName.trim() !== "";
  const showsUnreadBadge = unreadCount > 0 && !isSelected;

  return (
    <Link
      href={href}
      aria-current={isSelected ? "page" : undefined}
      className={cn(ROW_CLASS_NAME, isSelected ? "bg-accent" : "hover:bg-muted")}
    >
      <ContactAvatar profileName={contact.profileName} waId={contact.waId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-body font-semibold text-title">
            {hasProfileName ? contact.profileName : phoneNumber}
          </span>
          <ActivityTime lastActivityAt={lastActivityAt} />
        </div>
        {hasProfileName && <span className="text-meta text-muted-foreground tabular-nums">{phoneNumber}</span>}
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-meta", showsUnreadBadge ? "text-foreground" : "text-muted-foreground")}>
            {lastMessage === null ? "" : describeMessageContent(lastMessage)}
          </span>
          {showsUnreadBadge && <UnreadBadge unreadCount={unreadCount} />}
        </div>
      </div>
    </Link>
  );
}

/** Initials on a Mineral circle in Pine ink (plan §7b) — no photos. */
function ContactAvatar({ profileName, waId }: { profileName: string | null; waId: string }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-meta font-semibold text-title"
    >
      {getAvatarText(profileName, waId)}
    </span>
  );
}

/** Lagoon pill with the count; screen readers hear "3 sin leer" instead of a bare number. */
function UnreadBadge({ unreadCount }: { unreadCount: number }): React.ReactElement {
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-meta font-semibold text-primary-foreground tabular-nums">
      <span aria-hidden="true">{unreadCount}</span>
      <span className="sr-only">{formatUnreadCountLabel(unreadCount)}</span>
    </span>
  );
}

function ActivityTime({ lastActivityAt }: { lastActivityAt: Date }): React.ReactElement {
  return (
    <time
      dateTime={lastActivityAt.toISOString()}
      className="shrink-0 text-meta text-muted-foreground tabular-nums"
    >
      {formatActivityTime(lastActivityAt, new Date())}
    </time>
  );
}

/** First letter of up to two words of the name; otherwise the last digits of the number. */
function getAvatarText(profileName: string | null, waId: string): string {
  const words = (profileName ?? "").trim().split(/\s+/).filter((word) => word !== "");
  if (words.length > 0) {
    // `Array.from` so a letter outside the basic plane (or an emoji) is not cut in half.
    const initials = words.slice(0, MAX_INITIALS).map((word) => Array.from(word)[0]);
    return initials.join("").toUpperCase();
  }
  if (waId !== "") {
    return waId.slice(-FALLBACK_DIGITS_COUNT);
  }
  return EMPTY_AVATAR_TEXT;
}

/** Numbers are stored as Meta sends them (digits only, E.164 without "+"), so only the "+" is added. */
function formatPhoneNumber(waId: string): string {
  return `+${waId}`;
}

/** Today → "10:42"; any earlier day → "07/10". */
function formatActivityTime(lastActivityAt: Date, now: Date): string {
  if (isSameDay(lastActivityAt, now)) {
    return TIME_FORMATTER.format(lastActivityAt);
  }
  return SHORT_DATE_FORMATTER.format(lastActivityAt);
}

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatUnreadCountLabel(unreadCount: number): string {
  return `${unreadCount} sin leer`;
}
