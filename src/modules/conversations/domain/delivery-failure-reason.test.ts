import { describe, expect, it } from "vitest";

import { toDeliveryFailureReason } from "./delivery-failure-reason";

describe("toDeliveryFailureReason", () => {
  it("maps 131047 to outside_window", () => {
    expect(toDeliveryFailureReason(131047)).toBe("outside_window");
  });

  it("maps 131030 to recipient_not_allowed", () => {
    expect(toDeliveryFailureReason(131030)).toBe("recipient_not_allowed");
  });

  it("maps 131026 to undeliverable", () => {
    expect(toDeliveryFailureReason(131026)).toBe("undeliverable");
  });

  it("maps 131056 and 130429 to rate_limited", () => {
    expect(toDeliveryFailureReason(131056)).toBe("rate_limited");
    expect(toDeliveryFailureReason(130429)).toBe("rate_limited");
  });

  it("maps 190 to access_token_invalid", () => {
    expect(toDeliveryFailureReason(190)).toBe("access_token_invalid");
  });

  it("maps an unknown code to unknown", () => {
    expect(toDeliveryFailureReason(999999)).toBe("unknown");
  });

  it("maps a missing code to unknown", () => {
    expect(toDeliveryFailureReason(null)).toBe("unknown");
  });
});
