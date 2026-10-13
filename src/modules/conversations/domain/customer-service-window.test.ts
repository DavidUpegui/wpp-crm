import { describe, expect, it } from "vitest";

import {
  CUSTOMER_SERVICE_WINDOW_MS,
  customerServiceWindowClosesAt,
  isWithinCustomerServiceWindow,
} from "./customer-service-window";

const ONE_MINUTE_MS = 60 * 1000;
const LAST_INBOUND_AT = new Date("2026-10-12T10:00:00.000Z");

function timeAfterLastInbound(elapsedMs: number): Date {
  return new Date(LAST_INBOUND_AT.getTime() + elapsedMs);
}

describe("isWithinCustomerServiceWindow", () => {
  it("is open 23h59m after the last customer message", () => {
    const now = timeAfterLastInbound(CUSTOMER_SERVICE_WINDOW_MS - ONE_MINUTE_MS);

    expect(isWithinCustomerServiceWindow(LAST_INBOUND_AT, now)).toBe(true);
  });

  it("is closed exactly 24h after the last customer message", () => {
    const now = timeAfterLastInbound(CUSTOMER_SERVICE_WINDOW_MS);

    expect(isWithinCustomerServiceWindow(LAST_INBOUND_AT, now)).toBe(false);
  });

  it("is closed when the customer never wrote", () => {
    expect(isWithinCustomerServiceWindow(null, LAST_INBOUND_AT)).toBe(false);
  });
});

describe("customerServiceWindowClosesAt", () => {
  it("closes 24h after the last customer message", () => {
    expect(customerServiceWindowClosesAt(LAST_INBOUND_AT)).toEqual(
      new Date("2026-10-13T10:00:00.000Z"),
    );
  });
});
