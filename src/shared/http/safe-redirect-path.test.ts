import { describe, expect, it } from "vitest";

import { DEFAULT_REDIRECT_PATH, safeRedirectPath } from "./safe-redirect-path";

describe("safeRedirectPath", () => {
  it.each(["/users", "/users?x=1", "/inbox#latest"])("accepts the internal path %s", (path) => {
    // Act
    const result = safeRedirectPath(path);

    // Assert
    expect(result).toBe(path);
  });

  it.each([
    ["a protocol-relative URL", "//evil.com"],
    ["a backslash trick", "/\\evil.com"],
    ["an absolute URL", "https://evil.com"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a path with a control character", "/\tevil"],
    ["a relative path without a leading slash", "users"],
    ["an empty string", ""],
  ])("rejects %s and returns the default path", (_description, candidate) => {
    // Act
    const result = safeRedirectPath(candidate);

    // Assert
    expect(result).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("returns the default path when there is no candidate", () => {
    // Act + Assert
    expect(safeRedirectPath(null)).toBe("/inbox");
    expect(safeRedirectPath(undefined)).toBe("/inbox");
  });

  it("returns the given fallback when the candidate is unsafe", () => {
    // Act
    const result = safeRedirectPath("//evil.com", "/account");

    // Assert
    expect(result).toBe("/account");
  });
});
