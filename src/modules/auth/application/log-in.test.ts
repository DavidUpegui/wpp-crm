import { describe, expect, it } from "vitest";

import {
  AccountDisabledError,
  InvalidCredentialsError,
  TooManyLoginAttemptsError,
} from "@/modules/auth/domain/errors";
import { MAX_FAILED_LOGIN_ATTEMPTS } from "@/modules/auth/domain/login-attempt-policy";
import { buildUser } from "@/modules/users/application/testing/build-user";
import { FakePasswordHasher } from "@/modules/users/application/testing/fake-password-hasher";
import { InMemoryCredentialRepository } from "@/modules/users/application/testing/in-memory-credential-repository";
import { InMemoryUserRepository } from "@/modules/users/application/testing/in-memory-user-repository";
import type { User } from "@/modules/users/domain/user";

import { makeLogIn } from "./log-in";
import { FakeAuthenticator } from "./testing/fake-authenticator";
import { InMemoryLoginAttemptRepository } from "./testing/in-memory-login-attempt-repository";

const START_TIME = new Date("2026-05-01T12:00:00.000Z");
const SIXTEEN_MINUTES_MS = 16 * 60 * 1000;
const USER_ID = "ana";
const EMAIL = "ana@example.com";
const CORRECT_PASSWORD = "correct-password";
const WRONG_PASSWORD = "wrong-password";
const IP_ADDRESS = "203.0.113.10";
const OTHER_IP_ADDRESS = "198.51.100.20";

/** A clock the tests can move forward. */
class ControllableClock {
  private currentTime = new Date(START_TIME);

  now = (): Date => new Date(this.currentTime);

  advanceBy(milliseconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + milliseconds);
  }
}

async function setUp(userOverrides: Partial<User> = {}) {
  const clock = new ControllableClock();
  const users = new InMemoryUserRepository({ now: clock.now });
  const credentials = new InMemoryCredentialRepository();
  const passwordHasher = new FakePasswordHasher();
  const loginAttempts = new InMemoryLoginAttemptRepository();
  const authenticator = new FakeAuthenticator({ userRepository: users, credentialRepository: credentials, passwordHasher });

  users.seed(buildUser({ id: USER_ID, email: EMAIL, ...userOverrides }));
  await credentials.createForUser(USER_ID, await passwordHasher.hash(CORRECT_PASSWORD));

  const logIn = makeLogIn({
    loginAttemptRepository: loginAttempts,
    authenticator,
    userRepository: users,
    now: clock.now,
  });
  return { clock, users, loginAttempts, authenticator, logIn };
}

function loginInput(overrides: { email?: string; password?: string; ipAddress?: string } = {}) {
  return {
    email: EMAIL,
    password: CORRECT_PASSWORD,
    ipAddress: IP_ADDRESS,
    requestHeaders: new Headers(),
    ...overrides,
  };
}

/** Makes `count` failed logins (wrong password), ignoring the expected errors. */
async function failLogins(
  logIn: ReturnType<typeof makeLogIn>,
  count: number,
  overrides: { email?: string; ipAddress?: string } = {},
): Promise<void> {
  for (let attempt = 0; attempt < count; attempt += 1) {
    await expect(logIn(loginInput({ ...overrides, password: WRONG_PASSWORD }))).rejects.toThrow(
      InvalidCredentialsError,
    );
  }
}

describe("logIn", () => {
  it("logs in with correct credentials and returns the user id", async () => {
    // Arrange
    const { authenticator, logIn } = await setUp();

    // Act
    const result = await logIn(loginInput());

    // Assert
    expect(result).toEqual({ userId: USER_ID, mustChangePassword: false });
    expect(authenticator.createdSessions).toHaveLength(1);
  });

  it("tells the caller when the password must be changed", async () => {
    // Arrange
    const { logIn } = await setUp({ mustChangePassword: true });

    // Act
    const result = await logIn(loginInput());

    // Assert
    expect(result.mustChangePassword).toBe(true);
  });

  it("records the login time", async () => {
    // Arrange
    const { users, logIn } = await setUp();

    // Act
    await logIn(loginInput());

    // Assert
    expect((await users.findById(USER_ID))?.lastLoginAt).toEqual(START_TIME);
  });

  it("treats the email case-insensitively and ignores surrounding spaces", async () => {
    // Arrange
    const { loginAttempts, logIn } = await setUp();

    // Act
    const result = await logIn(loginInput({ email: "  Ana@Example.COM " }));
    await failLogins(logIn, 1, { email: " ANA@example.com" });

    // Assert
    expect(result.userId).toBe(USER_ID);
    expect(loginAttempts.allAttempts().map((attempt) => attempt.email)).toEqual([EMAIL]);
  });

  it("records a failed attempt for a wrong password and rethrows InvalidCredentialsError", async () => {
    // Arrange
    const { loginAttempts, authenticator, logIn } = await setUp();

    // Act
    const login = logIn(loginInput({ password: WRONG_PASSWORD }));

    // Assert
    await expect(login).rejects.toThrow(InvalidCredentialsError);
    expect(loginAttempts.allAttempts()).toEqual([{ email: EMAIL, ipAddress: IP_ADDRESS, attemptedAt: START_TIME }]);
    expect(authenticator.createdSessions).toHaveLength(0);
  });

  it("gives an unknown email the same InvalidCredentialsError and records the failure", async () => {
    // Arrange
    const { loginAttempts, logIn } = await setUp();

    // Act
    const login = logIn(loginInput({ email: "nobody@example.com" }));

    // Assert
    await expect(login).rejects.toThrow(InvalidCredentialsError);
    expect(loginAttempts.allAttempts()).toHaveLength(1);
  });

  it("does not record a failed attempt for a disabled account with the correct password", async () => {
    // Arrange
    const { users, loginAttempts, authenticator, logIn } = await setUp({ status: "inactive" });

    // Act
    const login = logIn(loginInput());

    // Assert
    await expect(login).rejects.toThrow(AccountDisabledError);
    expect(loginAttempts.allAttempts()).toHaveLength(0);
    expect(authenticator.createdSessions).toHaveLength(0);
    expect((await users.findById(USER_ID))?.lastLoginAt).toBeNull();
  });

  it("blocks the 6th attempt after 5 failures, even with the correct password", async () => {
    // Arrange
    const { users, authenticator, logIn } = await setUp();
    await failLogins(logIn, MAX_FAILED_LOGIN_ATTEMPTS);

    // Act
    const login = logIn(loginInput());

    // Assert
    await expect(login).rejects.toThrow(TooManyLoginAttemptsError);
    expect(authenticator.createdSessions).toHaveLength(0);
    expect((await users.findById(USER_ID))?.lastLoginAt).toBeNull();
  });

  it("allows logging in again once the 15-minute window has passed", async () => {
    // Arrange
    const { clock, logIn } = await setUp();
    await failLogins(logIn, MAX_FAILED_LOGIN_ATTEMPTS);
    clock.advanceBy(SIXTEEN_MINUTES_MS);

    // Act
    const result = await logIn(loginInput());

    // Assert
    expect(result.userId).toBe(USER_ID);
  });

  it("does not count failures from another IP or for another email toward the block", async () => {
    // Arrange
    const { logIn } = await setUp();
    await failLogins(logIn, MAX_FAILED_LOGIN_ATTEMPTS, { ipAddress: OTHER_IP_ADDRESS });
    await failLogins(logIn, MAX_FAILED_LOGIN_ATTEMPTS, { email: "other@example.com" });

    // Act
    const result = await logIn(loginInput());

    // Assert
    expect(result.userId).toBe(USER_ID);
  });

  it("clears the failed attempts for that email and IP after a successful login", async () => {
    // Arrange
    const { loginAttempts, logIn } = await setUp();
    await failLogins(logIn, MAX_FAILED_LOGIN_ATTEMPTS - 1);
    await failLogins(logIn, 1, { ipAddress: OTHER_IP_ADDRESS });

    // Act
    await logIn(loginInput());

    // Assert
    expect(loginAttempts.allAttempts()).toEqual([
      { email: EMAIL, ipAddress: OTHER_IP_ADDRESS, attemptedAt: START_TIME },
    ]);
  });
});
