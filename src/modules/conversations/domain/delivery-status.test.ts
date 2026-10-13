import { describe, expect, it } from "vitest";

import { nextDeliveryStatus } from "./delivery-status";

describe("nextDeliveryStatus", () => {
  it("moves forward from queued to sent, delivered and read", () => {
    expect(nextDeliveryStatus("queued", "sent")).toBe("sent");
    expect(nextDeliveryStatus("sent", "delivered")).toBe("delivered");
    expect(nextDeliveryStatus("delivered", "read")).toBe("read");
  });

  it("can skip steps when an earlier status webhook is missing", () => {
    expect(nextDeliveryStatus("queued", "read")).toBe("read");
  });

  it("keeps read when delivered arrives after read", () => {
    expect(nextDeliveryStatus("read", "delivered")).toBe("read");
  });

  it("keeps sent when sent arrives again", () => {
    expect(nextDeliveryStatus("sent", "sent")).toBe("sent");
  });

  it("applies failed from any non-failed status", () => {
    expect(nextDeliveryStatus("queued", "failed")).toBe("failed");
    expect(nextDeliveryStatus("read", "failed")).toBe("failed");
  });

  it("keeps failed as final whatever Meta reports later", () => {
    expect(nextDeliveryStatus("failed", "sent")).toBe("failed");
    expect(nextDeliveryStatus("failed", "read")).toBe("failed");
  });

  it("treats played as read", () => {
    expect(nextDeliveryStatus("delivered", "played")).toBe("read");
    expect(nextDeliveryStatus("read", "played")).toBe("read");
  });
});
