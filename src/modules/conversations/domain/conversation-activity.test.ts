import { describe, expect, it } from "vitest";

import { isNewerActivity } from "./conversation-activity";

const CURRENT_ACTIVITY_AT = new Date("2026-10-12T10:00:00.000Z");

describe("isNewerActivity", () => {
  it("replaces the latest activity with a newer message", () => {
    const candidate = new Date("2026-10-12T10:05:00.000Z");

    expect(isNewerActivity(candidate, CURRENT_ACTIVITY_AT)).toBe(true);
  });

  it("does not replace the latest activity with an older late-arriving message", () => {
    const candidate = new Date("2026-10-12T09:55:00.000Z");

    expect(isNewerActivity(candidate, CURRENT_ACTIVITY_AT)).toBe(false);
  });

  it("treats a message at the same time as newer", () => {
    expect(isNewerActivity(new Date(CURRENT_ACTIVITY_AT), CURRENT_ACTIVITY_AT)).toBe(true);
  });

  it("accepts any message when there is no activity yet", () => {
    expect(isNewerActivity(CURRENT_ACTIVITY_AT, null)).toBe(true);
  });
});
