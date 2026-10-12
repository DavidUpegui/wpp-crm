import { describe, expect, it } from "vitest";

import {
  assertAdminCanChangeRole,
  assertAdminCanDeactivate,
  assertAdminCanResetPassword,
  MINIMUM_ACTIVE_ADMINS,
} from "./admin-protections";
import { CannotModifyOwnAccountError, LastActiveAdminError } from "./errors";
import type { User } from "./user";

const ACTOR_ID = "actor-admin-id";

type Target = Pick<User, "id" | "role" | "status">;

const actorAsTarget: Target = { id: ACTOR_ID, role: "admin", status: "active" };
const otherActiveAdmin: Target = { id: "other-admin-id", role: "admin", status: "active" };
const otherInactiveAdmin: Target = { id: "inactive-admin-id", role: "admin", status: "inactive" };
const activeAgent: Target = { id: "agent-id", role: "agent", status: "active" };

describe("MINIMUM_ACTIVE_ADMINS", () => {
  it("requires at least one active admin", () => {
    expect(MINIMUM_ACTIVE_ADMINS).toBe(1);
  });
});

describe("assertAdminCanChangeRole", () => {
  it("allows promoting another user from agent to admin", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: activeAgent, newRole: "admin", activeAdminCount: 1 } as const;

    // Act + Assert
    expect(() => assertAdminCanChangeRole(input)).not.toThrow();
  });

  it("allows demoting another admin when two active admins exist", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: otherActiveAdmin, newRole: "agent", activeAdminCount: 2 } as const;

    // Act + Assert
    expect(() => assertAdminCanChangeRole(input)).not.toThrow();
  });

  it("rejects an admin changing their own role", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: actorAsTarget, newRole: "agent", activeAdminCount: 2 } as const;

    // Act + Assert
    expect(() => assertAdminCanChangeRole(input)).toThrow(CannotModifyOwnAccountError);
  });

  it("allows an admin to keep their own role (for example when only the name changes)", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: actorAsTarget, newRole: "admin", activeAdminCount: 1 } as const;

    // Act + Assert
    expect(() => assertAdminCanChangeRole(input)).not.toThrow();
  });

  it("rejects demoting the last active admin", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: otherActiveAdmin, newRole: "agent", activeAdminCount: 1 } as const;

    // Act + Assert
    expect(() => assertAdminCanChangeRole(input)).toThrow(LastActiveAdminError);
  });

  it("allows keeping an agent as agent even when only one admin exists", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: activeAgent, newRole: "agent", activeAdminCount: 1 } as const;

    // Act + Assert
    expect(() => assertAdminCanChangeRole(input)).not.toThrow();
  });

  it("allows demoting an inactive admin, because they are not the last active admin", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: otherInactiveAdmin, newRole: "agent", activeAdminCount: 1 } as const;

    // Act + Assert
    expect(() => assertAdminCanChangeRole(input)).not.toThrow();
  });
});

describe("assertAdminCanDeactivate", () => {
  it("allows deactivating another admin when two active admins exist", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: otherActiveAdmin, activeAdminCount: 2 };

    // Act + Assert
    expect(() => assertAdminCanDeactivate(input)).not.toThrow();
  });

  it("rejects an admin deactivating themselves", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: actorAsTarget, activeAdminCount: 2 };

    // Act + Assert
    expect(() => assertAdminCanDeactivate(input)).toThrow(CannotModifyOwnAccountError);
  });

  it("rejects deactivating the last active admin", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: otherActiveAdmin, activeAdminCount: 1 };

    // Act + Assert
    expect(() => assertAdminCanDeactivate(input)).toThrow(LastActiveAdminError);
  });

  it("allows deactivating an agent when only one admin exists", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: activeAgent, activeAdminCount: 1 };

    // Act + Assert
    expect(() => assertAdminCanDeactivate(input)).not.toThrow();
  });

  it("allows deactivating an inactive admin, because they are not the last active admin", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: otherInactiveAdmin, activeAdminCount: 1 };

    // Act + Assert
    expect(() => assertAdminCanDeactivate(input)).not.toThrow();
  });
});

describe("assertAdminCanResetPassword", () => {
  it("allows resetting another user's password", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: activeAgent };

    // Act + Assert
    expect(() => assertAdminCanResetPassword(input)).not.toThrow();
  });

  it("rejects an admin resetting their own password", () => {
    // Arrange
    const input = { actorId: ACTOR_ID, target: actorAsTarget };

    // Act + Assert
    expect(() => assertAdminCanResetPassword(input)).toThrow(CannotModifyOwnAccountError);
  });
});
