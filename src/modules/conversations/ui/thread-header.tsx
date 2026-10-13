"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CUSTOMER_SERVICE_WINDOW_MS } from "@/modules/conversations/domain/customer-service-window";
import type { ConversationDetail } from "@/modules/conversations/domain/inbox-views";
import {
  BACK_TO_LIST_LABEL,
  formatWindowOpenLabel,
  WINDOW_CLOSED_LABEL,
} from "@/modules/conversations/ui/messages";
import { useWindowCountdown, type WindowCountdown } from "@/modules/conversations/ui/use-window-countdown";

const MS_PER_HOUR = 60 * 60 * 1000;

const PILL_BASE_CLASS_NAME =
  "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-meta font-medium whitespace-nowrap tabular-nums";

/** Mint wash: a reply is possible. */
const OPEN_PILL_CLASS_NAME = "bg-accent text-accent-foreground";

/** Amber tint: a reply is still possible, but not for long. */
const CLOSING_SOON_PILL_CLASS_NAME = "bg-status-pending text-status-pending-foreground";

/** Slate tint: only templates can be sent. */
const CLOSED_PILL_CLASS_NAME = "bg-status-inactive text-status-inactive-foreground";

/** Props of {@link ThreadHeader}. */
export interface ThreadHeaderProps {
  conversation: ConversationDetail;
  /** Where "Volver" goes on mobile: the conversation list, keeping the search. */
  backHref: string;
}

/**
 * Top of an open conversation (FR-013, AC-5.6): who the customer is, whether
 * the 24h window is open, and the window meter — a 2px line whose width is
 * the share of the 24 hours still left (plan §7b, the inbox's signature).
 */
export function ThreadHeader({ conversation, backHref }: ThreadHeaderProps): React.ReactElement {
  const windowCountdown = useWindowCountdown(conversation.lastInboundAt);
  const phoneNumber = formatPhoneNumber(conversation.contact.waId);

  return (
    <header className="relative border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <BackToListLink href={backHref} />
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="truncate text-section font-semibold text-title">
            {conversation.contact.profileName ?? phoneNumber}
          </h2>
          <p className="text-meta text-muted-foreground tabular-nums">{phoneNumber}</p>
        </div>
        <WindowPill windowCountdown={windowCountdown} />
      </div>
      <WindowMeter windowCountdown={windowCountdown} />
    </header>
  );
}

/**
 * "← Volver" to the conversation list, only below `md`: on mobile the thread
 * is full screen, on desktop the list is always beside it. Also used by the
 * thread's loading, not-found and error states.
 */
export function BackToListLink({ href }: { href: string }): React.ReactElement {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-meta md:hidden")}
    >
      <ArrowLeft aria-hidden="true" />
      {BACK_TO_LIST_LABEL}
    </Link>
  );
}

function WindowPill({ windowCountdown }: { windowCountdown: WindowCountdown }): React.ReactElement {
  if (!windowCountdown.isOpen) {
    return <span className={cn(PILL_BASE_CLASS_NAME, CLOSED_PILL_CLASS_NAME)}>{WINDOW_CLOSED_LABEL}</span>;
  }

  const colorClassName = windowCountdown.isClosingSoon ? CLOSING_SOON_PILL_CLASS_NAME : OPEN_PILL_CLASS_NAME;
  return (
    <span className={cn(PILL_BASE_CLASS_NAME, colorClassName)}>
      {formatWindowOpenLabel(windowCountdown.remainingMs / MS_PER_HOUR)}
    </span>
  );
}

/** Decorative: the pill next to it already says the same in words. Absent when closed. */
function WindowMeter({ windowCountdown }: { windowCountdown: WindowCountdown }): React.ReactElement | null {
  if (!windowCountdown.isOpen) {
    return null;
  }

  const remainingShare = windowCountdown.remainingMs / CUSTOMER_SERVICE_WINDOW_MS;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute -bottom-px left-0 h-0.5",
        windowCountdown.isClosingSoon ? "bg-window-closing" : "bg-primary",
      )}
      style={{ width: `${remainingShare * 100}%` }}
    />
  );
}

/** "+573001234567": Meta stores numbers as digits only (wa_id), people read them with a "+". */
function formatPhoneNumber(waId: string): string {
  return `+${waId}`;
}
