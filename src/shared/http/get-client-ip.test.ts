import { describe, expect, it } from "vitest";

import { getClientIp } from "./get-client-ip";

describe("getClientIp", () => {
  it("uses the first address of X-Forwarded-For, trimmed", () => {
    // Arrange
    const headers = new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1", "x-real-ip": "10.0.0.2" });

    // Act
    const ip = getClientIp(headers);

    // Assert
    expect(ip).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP when there is no X-Forwarded-For", () => {
    // Arrange
    const headers = new Headers({ "x-real-ip": "198.51.100.4" });

    // Act
    const ip = getClientIp(headers);

    // Assert
    expect(ip).toBe("198.51.100.4");
  });

  it("returns unknown when no IP header is present", () => {
    // Arrange
    const headers = new Headers();

    // Act
    const ip = getClientIp(headers);

    // Assert
    expect(ip).toBe("unknown");
  });
});
