// Integration tests for the Drizzle login-attempt repository, against the real Postgres
// test database (`pnpm test:integration`).

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { LoginAttemptKey } from "@/modules/auth/domain/login-attempt-repository";
import { createTestDatabase, resetAuthTables } from "../../../../tests/integration/test-database";

import { DrizzleLoginAttemptRepository } from "./drizzle-login-attempt-repository";

const ANA_FROM_HOME: LoginAttemptKey = { email: "ana@example.com", ipAddress: "203.0.113.10" };
const ANA_FROM_OFFICE: LoginAttemptKey = { email: "ana@example.com", ipAddress: "198.51.100.20" };
const BRUNO_FROM_HOME: LoginAttemptKey = { email: "bruno@example.com", ipAddress: "203.0.113.10" };

const WINDOW_START = new Date("2026-05-01T12:00:00.000Z");
const ONE_MILLISECOND = 1;
const ONE_MINUTE_MS = 60 * 1000;

const testDatabase = createTestDatabase();
const loginAttempts = new DrizzleLoginAttemptRepository(testDatabase.database);

beforeEach(async () => {
  await resetAuthTables(testDatabase.database);
});

afterAll(async () => {
  await testDatabase.close();
});

function minutesAfterWindowStart(minutes: number): Date {
  return new Date(WINDOW_START.getTime() + minutes * ONE_MINUTE_MS);
}

describe("DrizzleLoginAttemptRepository", () => {
  it("counts failures for the same email and IP inside the window", async () => {
    // Arrange
    await loginAttempts.recordFailure(ANA_FROM_HOME, minutesAfterWindowStart(1));
    await loginAttempts.recordFailure(ANA_FROM_HOME, minutesAfterWindowStart(5));
    await loginAttempts.recordFailure(ANA_FROM_HOME, minutesAfterWindowStart(10));

    // Act
    const failureCount = await loginAttempts.countRecentFailures(ANA_FROM_HOME, WINDOW_START);

    // Assert
    expect(failureCount).toBe(3);
  });

  it("does not count failures older than the window start", async () => {
    // Arrange: one failure exactly at the start (counts) and one 1 ms before (does not).
    await loginAttempts.recordFailure(ANA_FROM_HOME, WINDOW_START);
    await loginAttempts.recordFailure(ANA_FROM_HOME, new Date(WINDOW_START.getTime() - ONE_MILLISECOND));
    await loginAttempts.recordFailure(ANA_FROM_HOME, minutesAfterWindowStart(-30));

    // Act
    const failureCount = await loginAttempts.countRecentFailures(ANA_FROM_HOME, WINDOW_START);

    // Assert
    expect(failureCount).toBe(1);
  });

  it("does not count failures from another IP or for another email", async () => {
    // Arrange
    await loginAttempts.recordFailure(ANA_FROM_HOME, minutesAfterWindowStart(1));
    await loginAttempts.recordFailure(ANA_FROM_OFFICE, minutesAfterWindowStart(2));
    await loginAttempts.recordFailure(BRUNO_FROM_HOME, minutesAfterWindowStart(3));

    // Act
    const failureCount = await loginAttempts.countRecentFailures(ANA_FROM_HOME, WINDOW_START);

    // Assert
    expect(failureCount).toBe(1);
  });

  it("clearFailures removes only that email and IP pair", async () => {
    // Arrange
    await loginAttempts.recordFailure(ANA_FROM_HOME, minutesAfterWindowStart(1));
    await loginAttempts.recordFailure(ANA_FROM_HOME, minutesAfterWindowStart(2));
    await loginAttempts.recordFailure(ANA_FROM_OFFICE, minutesAfterWindowStart(3));
    await loginAttempts.recordFailure(BRUNO_FROM_HOME, minutesAfterWindowStart(4));

    // Act
    await loginAttempts.clearFailures(ANA_FROM_HOME);

    // Assert
    expect(await loginAttempts.countRecentFailures(ANA_FROM_HOME, WINDOW_START)).toBe(0);
    expect(await loginAttempts.countRecentFailures(ANA_FROM_OFFICE, WINDOW_START)).toBe(1);
    expect(await loginAttempts.countRecentFailures(BRUNO_FROM_HOME, WINDOW_START)).toBe(1);
  });

  it("returns 0 when there are no failures", async () => {
    // Act
    const failureCount = await loginAttempts.countRecentFailures(ANA_FROM_HOME, WINDOW_START);

    // Assert
    expect(failureCount).toBe(0);
  });
});
