// Proves the auth fakes honor the same contract as the real implementations
// (AGENTS.md §5.3 L), because every log-in use case test relies on them.

import { describe, expect, it } from "vitest";

import { AccountDisabledError, InvalidCredentialsError } from "@/modules/auth/domain/errors";
import { buildUser } from "@/modules/users/application/testing/build-user";
import { FakePasswordHasher } from "@/modules/users/application/testing/fake-password-hasher";
import { InMemoryCredentialRepository } from "@/modules/users/application/testing/in-memory-credential-repository";
import { InMemoryUserRepository } from "@/modules/users/application/testing/in-memory-user-repository";
import type { UserStatus } from "@/modules/users/domain/user";

import { FakeAuthenticator } from "./fake-authenticator";
import { InMemoryLoginAttemptRepository } from "./in-memory-login-attempt-repository";

const ANA_EMAIL = "ana@example.com";
const CORRECT_PASSWORD = "correct-password";
const WRONG_PASSWORD = "wrong-password";

async function createAuthenticatorWithAna(status: UserStatus = "active"): Promise<FakeAuthenticator> {
  const userRepository = new InMemoryUserRepository();
  const credentialRepository = new InMemoryCredentialRepository();
  const passwordHasher = new FakePasswordHasher();
  userRepository.seed(buildUser({ id: "ana", email: ANA_EMAIL, status }));
  await credentialRepository.createForUser("ana", await passwordHasher.hash(CORRECT_PASSWORD));
  return new FakeAuthenticator({ userRepository, credentialRepository, passwordHasher });
}

function signInAs(authenticator: FakeAuthenticator, email: string, password: string): Promise<{ userId: string }> {
  return authenticator.signIn({ email, password, requestHeaders: new Headers() });
}

describe("FakeAuthenticator", () => {
  it("rejects a wrong password with InvalidCredentialsError", async () => {
    // Arrange
    const authenticator = await createAuthenticatorWithAna();

    // Act + Assert
    await expect(signInAs(authenticator, ANA_EMAIL, WRONG_PASSWORD)).rejects.toThrow(InvalidCredentialsError);
    expect(authenticator.createdSessions).toEqual([]);
  });

  it("rejects an unknown email with the same InvalidCredentialsError", async () => {
    // Arrange
    const authenticator = await createAuthenticatorWithAna();

    // Act + Assert
    await expect(signInAs(authenticator, "nobody@example.com", CORRECT_PASSWORD)).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it("does not reveal a disabled account when the password is wrong", async () => {
    // Arrange
    const authenticator = await createAuthenticatorWithAna("inactive");

    // Act + Assert
    await expect(signInAs(authenticator, ANA_EMAIL, WRONG_PASSWORD)).rejects.toThrow(InvalidCredentialsError);
  });

  it("rejects a disabled account with AccountDisabledError when the password is correct", async () => {
    // Arrange
    const authenticator = await createAuthenticatorWithAna("inactive");

    // Act + Assert
    await expect(signInAs(authenticator, ANA_EMAIL, CORRECT_PASSWORD)).rejects.toThrow(AccountDisabledError);
    expect(authenticator.createdSessions).toEqual([]);
  });

  it("returns the user id and records a session when the credentials are correct", async () => {
    // Arrange
    const authenticator = await createAuthenticatorWithAna();

    // Act
    const result = await signInAs(authenticator, ANA_EMAIL, CORRECT_PASSWORD);

    // Assert
    expect(result).toEqual({ userId: "ana" });
    expect(authenticator.createdSessions).toEqual([{ sessionId: "session-1", userId: "ana" }]);
  });

  it("records every sign-out call", async () => {
    // Arrange
    const authenticator = await createAuthenticatorWithAna();
    const requestHeaders = new Headers();

    // Act
    await authenticator.signOut(requestHeaders);

    // Assert
    expect(authenticator.signOutCalls).toEqual([requestHeaders]);
  });
});

describe("InMemoryLoginAttemptRepository", () => {
  const ANA_FROM_HOME = { email: ANA_EMAIL, ipAddress: "10.0.0.1" };
  const ANA_FROM_OFFICE = { email: ANA_EMAIL, ipAddress: "10.0.0.2" };
  const BRUNO_FROM_HOME = { email: "bruno@example.com", ipAddress: "10.0.0.1" };
  const WINDOW_START = new Date("2026-01-15T10:15:00.000Z");

  it("counts only failures of the same email and IP at or after the window start", async () => {
    // Arrange
    const repository = new InMemoryLoginAttemptRepository();
    await repository.recordFailure(ANA_FROM_HOME, new Date("2026-01-15T10:14:59.999Z"));
    await repository.recordFailure(ANA_FROM_HOME, WINDOW_START);
    await repository.recordFailure(ANA_FROM_HOME, new Date("2026-01-15T10:20:00.000Z"));
    await repository.recordFailure(ANA_FROM_OFFICE, new Date("2026-01-15T10:20:00.000Z"));
    await repository.recordFailure(BRUNO_FROM_HOME, new Date("2026-01-15T10:20:00.000Z"));

    // Act
    const recentFailures = await repository.countRecentFailures(ANA_FROM_HOME, WINDOW_START);

    // Assert
    expect(recentFailures).toBe(2);
  });

  it("clears only the failures of the given email and IP", async () => {
    // Arrange
    const repository = new InMemoryLoginAttemptRepository();
    const attemptedAt = new Date("2026-01-15T10:20:00.000Z");
    await repository.recordFailure(ANA_FROM_HOME, attemptedAt);
    await repository.recordFailure(ANA_FROM_OFFICE, attemptedAt);
    await repository.recordFailure(BRUNO_FROM_HOME, attemptedAt);

    // Act
    await repository.clearFailures(ANA_FROM_HOME);

    // Assert
    expect(repository.allAttempts()).toEqual([
      { ...ANA_FROM_OFFICE, attemptedAt },
      { ...BRUNO_FROM_HOME, attemptedAt },
    ]);
  });
});
