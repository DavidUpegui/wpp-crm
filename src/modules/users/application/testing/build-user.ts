// TEST-ONLY helper. Never import this file from production code.

import type { User } from "@/modules/users/domain/user";

const DEFAULT_DATE = new Date("2026-01-01T00:00:00.000Z");

/**
 * Builds a complete `User` for tests, so each test only spells out the
 * fields it cares about. Defaults: an active agent who does not need to
 * change their password and has never logged in.
 */
export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-default",
    name: "Test User",
    email: "test.user@example.com",
    role: "agent",
    status: "active",
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: DEFAULT_DATE,
    updatedAt: DEFAULT_DATE,
    ...overrides,
  };
}
