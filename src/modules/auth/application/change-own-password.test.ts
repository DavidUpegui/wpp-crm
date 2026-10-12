import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { WrongCurrentPasswordError } from "@/modules/auth/domain/errors";
import { buildUser } from "@/modules/users/application/testing/build-user";
import { FakePasswordHasher } from "@/modules/users/application/testing/fake-password-hasher";
import { InMemoryCredentialRepository } from "@/modules/users/application/testing/in-memory-credential-repository";
import {
  InMemoryUserRepository,
  InMemoryUserTransactionRunner,
} from "@/modules/users/application/testing/in-memory-user-repository";
import { SpySessionRevoker } from "@/modules/users/application/testing/spy-session-revoker";
import { NewPasswordSameAsCurrentError, PasswordPolicyError } from "@/modules/users/domain/errors";

import { makeChangeOwnPassword } from "./change-own-password";

const USER_ID = "ana-agent";
const CURRENT_SESSION_ID = "session-current";
const OLD_PASSWORD = "old-password-123";
const OLD_PASSWORD_HASH = `hashed:${OLD_PASSWORD}`;
const NEW_PASSWORD = "new-password-456";

/** Seeds one user with an existing password and builds the use case plus a matching `CurrentUser`. */
async function setUp(options: { mustChangePassword: boolean }) {
  const userRecord = buildUser({
    id: USER_ID,
    name: "Ana Agent",
    email: "ana@example.com",
    mustChangePassword: options.mustChangePassword,
  });
  const users = new InMemoryUserRepository();
  users.seed(userRecord);

  const credentials = new InMemoryCredentialRepository();
  await credentials.createForUser(USER_ID, OLD_PASSWORD_HASH);

  const currentUser: CurrentUser = {
    id: USER_ID,
    name: userRecord.name,
    email: userRecord.email,
    role: userRecord.role,
    mustChangePassword: options.mustChangePassword,
    sessionId: CURRENT_SESSION_ID,
  };

  const sessionRevoker = new SpySessionRevoker();
  const changeOwnPassword = makeChangeOwnPassword({
    transactionRunner: new InMemoryUserTransactionRunner(users, credentials),
    passwordHasher: new FakePasswordHasher(),
    sessionRevoker,
  });
  return { users, credentials, sessionRevoker, currentUser, userRecord, changeOwnPassword };
}

describe("changeOwnPassword", () => {
  it('"Mi cuenta": changes the password when the current password is correct', async () => {
    // Arrange
    const { credentials, currentUser, changeOwnPassword } = await setUp({ mustChangePassword: false });

    // Act
    await changeOwnPassword({ currentUser, currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

    // Assert
    expect(await credentials.getPasswordHash(USER_ID)).toBe(`hashed:${NEW_PASSWORD}`);
  });

  it('"Mi cuenta": rejects a wrong current password, changes nothing and revokes no sessions', async () => {
    // Arrange
    const { credentials, sessionRevoker, currentUser, changeOwnPassword } = await setUp({
      mustChangePassword: false,
    });

    // Act
    const change = changeOwnPassword({
      currentUser,
      currentPassword: "wrong-password-999",
      newPassword: NEW_PASSWORD,
    });

    // Assert
    await expect(change).rejects.toThrow(WrongCurrentPasswordError);
    expect(await credentials.getPasswordHash(USER_ID)).toBe(OLD_PASSWORD_HASH);
    expect(sessionRevoker.revokedAllExcept).toEqual([]);
  });

  it('"Mi cuenta": rejects a missing current password when the change is not forced', async () => {
    // Arrange
    const { credentials, sessionRevoker, currentUser, changeOwnPassword } = await setUp({
      mustChangePassword: false,
    });

    // Act
    const change = changeOwnPassword({ currentUser, newPassword: NEW_PASSWORD });

    // Assert
    await expect(change).rejects.toThrow(WrongCurrentPasswordError);
    expect(await credentials.getPasswordHash(USER_ID)).toBe(OLD_PASSWORD_HASH);
    expect(sessionRevoker.revokedAllExcept).toEqual([]);
  });

  it("forced change: changes the password without the current password and clears mustChangePassword", async () => {
    // Arrange
    const { users, credentials, currentUser, changeOwnPassword } = await setUp({ mustChangePassword: true });

    // Act
    await changeOwnPassword({ currentUser, newPassword: NEW_PASSWORD });

    // Assert
    expect(await credentials.getPasswordHash(USER_ID)).toBe(`hashed:${NEW_PASSWORD}`);
    expect((await users.findById(USER_ID))?.mustChangePassword).toBe(false);
  });

  it("forced change: ignores a current password that is sent anyway", async () => {
    // Arrange
    const { credentials, currentUser, changeOwnPassword } = await setUp({ mustChangePassword: true });

    // Act
    await changeOwnPassword({ currentUser, currentPassword: "anything-at-all", newPassword: NEW_PASSWORD });

    // Assert
    expect(await credentials.getPasswordHash(USER_ID)).toBe(`hashed:${NEW_PASSWORD}`);
  });

  it("rejects a new password equal to the current (temporary) one and changes nothing", async () => {
    // Arrange
    const { users, credentials, sessionRevoker, currentUser, userRecord, changeOwnPassword } = await setUp({
      mustChangePassword: true,
    });

    // Act
    const change = changeOwnPassword({ currentUser, newPassword: OLD_PASSWORD });

    // Assert
    await expect(change).rejects.toThrow(NewPasswordSameAsCurrentError);
    expect(await credentials.getPasswordHash(USER_ID)).toBe(OLD_PASSWORD_HASH);
    expect(await users.findById(USER_ID)).toEqual(userRecord);
    expect(sessionRevoker.revokedAllExcept).toEqual([]);
  });

  it("rejects a new password shorter than 10 characters and changes nothing", async () => {
    // Arrange
    const { users, credentials, sessionRevoker, currentUser, userRecord, changeOwnPassword } = await setUp({
      mustChangePassword: true,
    });

    // Act
    const change = changeOwnPassword({ currentUser, newPassword: "short" });

    // Assert
    await expect(change).rejects.toThrow(PasswordPolicyError);
    expect(await credentials.getPasswordHash(USER_ID)).toBe(OLD_PASSWORD_HASH);
    expect(await users.findById(USER_ID)).toEqual(userRecord);
    expect(sessionRevoker.revokedAllExcept).toEqual([]);
  });

  it("ends the user's other sessions but keeps the current one", async () => {
    // Arrange
    const { sessionRevoker, currentUser, changeOwnPassword } = await setUp({ mustChangePassword: false });

    // Act
    await changeOwnPassword({ currentUser, currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

    // Assert
    expect(sessionRevoker.revokedAllExcept).toEqual([{ userId: USER_ID, keepSessionId: CURRENT_SESSION_ID }]);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });
});
