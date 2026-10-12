import { describe, expect, it } from "vitest";

import { ForbiddenError } from "./errors";
import { assertIsAdmin, isAdmin } from "./permissions";

describe("isAdmin", () => {
  it("returns true for an admin", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  it("returns false for an agent", () => {
    expect(isAdmin({ role: "agent" })).toBe(false);
  });
});

describe("assertIsAdmin", () => {
  it("allows an admin", () => {
    // Arrange
    const admin = { role: "admin" } as const;

    // Act + Assert
    expect(() => assertIsAdmin(admin)).not.toThrow();
  });

  it("rejects an agent with ForbiddenError", () => {
    // Arrange
    const agent = { role: "agent" } as const;

    // Act + Assert
    expect(() => assertIsAdmin(agent)).toThrow(ForbiddenError);
  });
});
