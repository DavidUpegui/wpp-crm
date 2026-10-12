import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/shared/errors/forbidden-error";

import { assertSameOrigin } from "./assert-same-origin";

const APP_URL = "http://localhost:3000";

function postRequest(headers: Record<string, string>): Request {
  return new Request(`${APP_URL}/api/users`, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("allows a request whose Origin is the app's own origin", () => {
    // Arrange
    const request = postRequest({ origin: APP_URL, "sec-fetch-site": "same-origin" });

    // Act + Assert
    expect(() => assertSameOrigin(request, APP_URL)).not.toThrow();
  });

  it("compares only the origin of the allowed URL, ignoring a path or trailing slash", () => {
    // Arrange
    const request = postRequest({ origin: APP_URL });

    // Act + Assert
    expect(() => assertSameOrigin(request, `${APP_URL}/`)).not.toThrow();
  });

  it("rejects a request from another origin", () => {
    // Arrange
    const request = postRequest({ origin: "https://evil.com" });

    // Act + Assert
    expect(() => assertSameOrigin(request, APP_URL)).toThrow(ForbiddenError);
  });

  it("rejects a request the browser marks as cross-site", () => {
    // Arrange
    const request = postRequest({ "sec-fetch-site": "cross-site" });

    // Act + Assert
    expect(() => assertSameOrigin(request, APP_URL)).toThrow(ForbiddenError);
  });

  it("allows a request without Origin, like one from curl or Postman", () => {
    // Arrange
    const request = postRequest({});

    // Act + Assert
    expect(() => assertSameOrigin(request, APP_URL)).not.toThrow();
  });
});
