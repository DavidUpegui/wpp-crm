import { describe, expect, it } from "vitest";

import { PasswordPolicyError, type PasswordPolicyViolation } from "./errors";
import {
  assertPasswordMeetsPolicy,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "./password-policy";

function passwordOfLength(length: number): string {
  return "a".repeat(length);
}

function expectPolicyViolation(password: string, expectedReason: PasswordPolicyViolation): void {
  let thrownError: unknown;
  try {
    assertPasswordMeetsPolicy(password);
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(PasswordPolicyError);
  expect((thrownError as PasswordPolicyError).reason).toBe(expectedReason);
  expect((thrownError as PasswordPolicyError).code).toBe("PASSWORD_POLICY");
}

describe("assertPasswordMeetsPolicy", () => {
  it("uses 10 as the minimum and 128 as the maximum length", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(MAX_PASSWORD_LENGTH).toBe(128);
  });

  it("rejects a 9-character password as too_short", () => {
    expectPolicyViolation(passwordOfLength(9), "too_short");
  });

  it("accepts a password of exactly 10 characters", () => {
    expect(() => assertPasswordMeetsPolicy(passwordOfLength(10))).not.toThrow();
  });

  it("accepts a password of exactly 128 characters", () => {
    expect(() => assertPasswordMeetsPolicy(passwordOfLength(128))).not.toThrow();
  });

  it("rejects a 129-character password as too_long", () => {
    expectPolicyViolation(passwordOfLength(129), "too_long");
  });

  it("rejects an empty password as too_short", () => {
    expectPolicyViolation("", "too_short");
  });
});
