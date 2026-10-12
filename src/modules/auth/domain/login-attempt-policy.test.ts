import { describe, expect, it } from "vitest";

import {
  FAILED_LOGIN_WINDOW_MS,
  getFailedLoginWindowStart,
  isLoginBlocked,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "./login-attempt-policy";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

describe("login attempt policy constants", () => {
  it("allows 5 failed attempts inside a 15 minute window", () => {
    expect(MAX_FAILED_LOGIN_ATTEMPTS).toBe(5);
    expect(FAILED_LOGIN_WINDOW_MS).toBe(FIFTEEN_MINUTES_MS);
  });
});

describe("isLoginBlocked", () => {
  it("does not block when there are no recent failures", () => {
    expect(isLoginBlocked(0)).toBe(false);
  });

  it("does not block after 4 recent failures", () => {
    expect(isLoginBlocked(4)).toBe(false);
  });

  it("blocks the 6th attempt after 5 recent failures", () => {
    expect(isLoginBlocked(5)).toBe(true);
  });

  it("keeps blocking after more than 5 recent failures", () => {
    expect(isLoginBlocked(6)).toBe(true);
  });
});

describe("getFailedLoginWindowStart", () => {
  it("returns exactly 15 minutes before now", () => {
    const now = new Date("2026-01-15T10:30:00.000Z");

    const windowStart = getFailedLoginWindowStart(now);

    expect(windowStart.toISOString()).toBe("2026-01-15T10:15:00.000Z");
  });

  it("does not change the date it receives", () => {
    const now = new Date("2026-01-15T10:30:00.000Z");

    getFailedLoginWindowStart(now);

    expect(now.toISOString()).toBe("2026-01-15T10:30:00.000Z");
  });
});
