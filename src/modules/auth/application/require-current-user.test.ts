import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { PasswordChangeRequiredError, UnauthenticatedError } from "@/modules/auth/domain/errors";
import { ForbiddenError } from "@/modules/users/domain/errors";
import { makeRequireCurrentUser } from "./require-current-user";

function buildCurrentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "ana",
    name: "Ana",
    email: "ana@example.com",
    role: "agent",
    mustChangePassword: false,
    sessionId: "session-1",
    ...overrides,
  };
}

/** Builds `requireCurrentUser` over a stub `getCurrentUser` that always returns `currentUser`. */
function setUp(currentUser: CurrentUser | null) {
  return makeRequireCurrentUser({ getCurrentUser: async () => currentUser });
}

describe("requireCurrentUser", () => {
  it("throws UnauthenticatedError when there is no current user", async () => {
    // Arrange
    const requireCurrentUser = setUp(null);

    // Act
    const result = requireCurrentUser(new Headers());

    // Assert
    await expect(result).rejects.toThrow(UnauthenticatedError);
  });

  it("returns the current user when nothing else is required", async () => {
    // Arrange
    const agent = buildCurrentUser();
    const requireCurrentUser = setUp(agent);

    // Act
    const result = await requireCurrentUser(new Headers());

    // Assert
    expect(result).toEqual(agent);
  });

  it("throws PasswordChangeRequiredError when the password must be changed", async () => {
    // Arrange
    const requireCurrentUser = setUp(buildCurrentUser({ mustChangePassword: true }));

    // Act
    const result = requireCurrentUser(new Headers());

    // Assert
    await expect(result).rejects.toThrow(PasswordChangeRequiredError);
  });

  it("allows a pending password change when allowPendingPasswordChange is true", async () => {
    // Arrange
    const userWithTemporaryPassword = buildCurrentUser({ mustChangePassword: true });
    const requireCurrentUser = setUp(userWithTemporaryPassword);

    // Act
    const result = await requireCurrentUser(new Headers(), { allowPendingPasswordChange: true });

    // Assert
    expect(result).toEqual(userWithTemporaryPassword);
  });

  it("throws ForbiddenError for an agent on an admin-only check", async () => {
    // Arrange
    const requireCurrentUser = setUp(buildCurrentUser({ role: "agent" }));

    // Act
    const result = requireCurrentUser(new Headers(), { role: "admin" });

    // Assert
    await expect(result).rejects.toThrow(ForbiddenError);
  });

  it("returns an admin on an admin-only check", async () => {
    // Arrange
    const admin = buildCurrentUser({ role: "admin" });
    const requireCurrentUser = setUp(admin);

    // Act
    const result = await requireCurrentUser(new Headers(), { role: "admin" });

    // Assert
    expect(result).toEqual(admin);
  });

  it("asks an agent with a temporary password to change it before checking the admin role", async () => {
    // Arrange
    const requireCurrentUser = setUp(buildCurrentUser({ role: "agent", mustChangePassword: true }));

    // Act
    const result = requireCurrentUser(new Headers(), { role: "admin" });

    // Assert
    await expect(result).rejects.toThrow(PasswordChangeRequiredError);
  });
});
