import { describe, expect, it } from "vitest";

import { getVerificationChallenge } from "./webhook-verification";

const VERIFY_TOKEN = "expected-verify-token";
const CHALLENGE = "1158201444";

describe("getVerificationChallenge", () => {
  it("returns the challenge when mode is subscribe and the token matches", () => {
    const query = { mode: "subscribe", verifyToken: VERIFY_TOKEN, challenge: CHALLENGE };

    expect(getVerificationChallenge(query, VERIFY_TOKEN)).toBe(CHALLENGE);
  });

  it("returns null when the verify token is wrong", () => {
    const query = { mode: "subscribe", verifyToken: "wrong-token", challenge: CHALLENGE };

    expect(getVerificationChallenge(query, VERIFY_TOKEN)).toBeNull();
  });

  it("returns null when the verify token is missing", () => {
    const query = { mode: "subscribe", verifyToken: null, challenge: CHALLENGE };

    expect(getVerificationChallenge(query, VERIFY_TOKEN)).toBeNull();
  });

  it("returns null when the mode is not subscribe", () => {
    const query = { mode: "unsubscribe", verifyToken: VERIFY_TOKEN, challenge: CHALLENGE };

    expect(getVerificationChallenge(query, VERIFY_TOKEN)).toBeNull();
  });

  it("returns null when the challenge is missing", () => {
    const query = { mode: "subscribe", verifyToken: VERIFY_TOKEN, challenge: null };

    expect(getVerificationChallenge(query, VERIFY_TOKEN)).toBeNull();
  });
});
