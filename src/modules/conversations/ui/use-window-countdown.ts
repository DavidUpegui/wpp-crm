"use client";

import { useEffect, useState } from "react";

import {
  CUSTOMER_SERVICE_WINDOW_MS,
  customerServiceWindowClosesAt,
  isWithinCustomerServiceWindow,
} from "@/modules/conversations/domain/customer-service-window";

/** How often the window is re-evaluated: the pill shows whole hours, so once a minute is enough. */
const TICK_MS = 60_000;

/** From this point before closing, the pill and the meter turn Amber (plan §7b). */
const CLOSING_SOON_MS = 2 * 60 * 60 * 1000;

/** The state of the 24h customer service window at the current minute. */
export interface WindowCountdown {
  isOpen: boolean;
  /** When the window closes; null when the customer never wrote. */
  closesAt: Date | null;
  /** Time left until it closes, between 0 and 24 h (0 when closed). */
  remainingMs: number;
  /** True during the last 2 hours of an open window. */
  isClosingSoon: boolean;
}

/**
 * Tells the thread header and the composer whether a free-form reply is
 * allowed right now (BR-001, AC-5.6). It re-evaluates every minute, so the
 * pill counts down and the composer closes on its own without a reload.
 */
export function useWindowCountdown(lastInboundAt: Date | null): WindowCountdown {
  const now = useCurrentTime();
  return describeWindow(lastInboundAt, now);
}

function useCurrentTime(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(intervalId);
  }, []);

  return now;
}

function describeWindow(lastInboundAt: Date | null, now: Date): WindowCountdown {
  if (lastInboundAt === null) {
    return { isOpen: false, closesAt: null, remainingMs: 0, isClosingSoon: false };
  }

  const closesAt = customerServiceWindowClosesAt(lastInboundAt);
  if (!isWithinCustomerServiceWindow(lastInboundAt, now)) {
    return { isOpen: false, closesAt, remainingMs: 0, isClosingSoon: false };
  }

  // The clock only ticks once a minute, so a message newer than `now` could
  // give more than 24 h left; clamping keeps the meter within its track.
  const remainingMs = Math.min(closesAt.getTime() - now.getTime(), CUSTOMER_SERVICE_WINDOW_MS);
  return { isOpen: true, closesAt, remainingMs, isClosingSoon: remainingMs <= CLOSING_SOON_MS };
}
