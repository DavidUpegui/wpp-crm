import { describe, expect, it } from "vitest";

import type { Actor } from "@/modules/users/domain/actor";
import {
  CannotModifyOwnAccountError,
  ForbiddenError,
  PasswordPolicyError,
  UserNotFoundError,
} from "@/modules/users/domain/errors";

import { makeResetUserPassword } from "./reset-user-password";
import { buildUser } from "./testing/build-user";
import { FakePasswordHasher } from "./testing/fake-password-hasher";
import { InMemoryCredentialRepository } from "./testing/in-memory-credential-repository";
import { InMemoryUserRepository, InMemoryUserTransactionRunner } from "./testing/in-memory-user-repository";
import { SpySessionRevoker } from "./testing/spy-session-revoker";

const ADMIN_ACTOR: Actor = { id: "admin-actor", role: "admin" };
const AGENT_ACTOR: Actor = { id: "agent-actor", role: "agent" };
const AGENT_ID = "bruno-agent";
const OLD_PASSWORD_HASH = "hashed:old-password-123";
const TEMPORARY_PASSWORD = "temporary-password";

const ACTOR_RECORD = buildUser({ id: ADMIN_ACTOR.id, name: "Ana Admin", email: "ana@example.com", role: "admin" });
const AGENT_RECORD = buildUser({ id: AGENT_ID, name: "Bruno Agent", email: "bruno@example.com", role: "agent" });

/** Seeds the admin actor and one agent, both with an existing password, and builds the use case. */
async function setUp() {
  const users = new InMemoryUserRepository();
  users.seed(ACTOR_RECORD);
  users.seed(AGENT_RECORD);

  const credentials = new InMemoryCredentialRepository();
  await credentials.createForUser(ADMIN_ACTOR.id, OLD_PASSWORD_HASH);
  await credentials.createForUser(AGENT_ID, OLD_PASSWORD_HASH);

  const sessionRevoker = new SpySessionRevoker();
  const resetUserPassword = makeResetUserPassword({
    transactionRunner: new InMemoryUserTransactionRunner(users, credentials),
    passwordHasher: new FakePasswordHasher(),
    sessionRevoker,
  });
  return { users, credentials, sessionRevoker, resetUserPassword };
}

describe("resetUserPassword", () => {
  it("stores the new temporary password as a hash", async () => {
    // Arrange
    const { credentials, resetUserPassword } = await setUp();

    // Act
    await resetUserPassword({ actor: ADMIN_ACTOR, userId: AGENT_ID, temporaryPassword: TEMPORARY_PASSWORD });

    // Assert
    expect(await credentials.getPasswordHash(AGENT_ID)).toBe(`hashed:${TEMPORARY_PASSWORD}`);
  });

  it("marks the user as having to change the password", async () => {
    // Arrange
    const { users, resetUserPassword } = await setUp();

    // Act
    await resetUserPassword({ actor: ADMIN_ACTOR, userId: AGENT_ID, temporaryPassword: TEMPORARY_PASSWORD });

    // Assert
    expect((await users.findById(AGENT_ID))?.mustChangePassword).toBe(true);
  });

  it("ends all of the user's sessions", async () => {
    // Arrange
    const { sessionRevoker, resetUserPassword } = await setUp();

    // Act
    await resetUserPassword({ actor: ADMIN_ACTOR, userId: AGENT_ID, temporaryPassword: TEMPORARY_PASSWORD });

    // Assert
    expect(sessionRevoker.revokedAllForUser).toEqual([AGENT_ID]);
  });

  it("rejects an admin resetting their own password, changes nothing and revokes no sessions", async () => {
    // Arrange
    const { users, credentials, sessionRevoker, resetUserPassword } = await setUp();

    // Act
    const reset = resetUserPassword({
      actor: ADMIN_ACTOR,
      userId: ADMIN_ACTOR.id,
      temporaryPassword: TEMPORARY_PASSWORD,
    });

    // Assert
    await expect(reset).rejects.toThrow(CannotModifyOwnAccountError);
    expect(await credentials.getPasswordHash(ADMIN_ACTOR.id)).toBe(OLD_PASSWORD_HASH);
    expect(await users.findById(ADMIN_ACTOR.id)).toEqual(ACTOR_RECORD);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });

  it("rejects a weak temporary password, changes nothing and revokes no sessions", async () => {
    // Arrange
    const { users, credentials, sessionRevoker, resetUserPassword } = await setUp();

    // Act
    const reset = resetUserPassword({ actor: ADMIN_ACTOR, userId: AGENT_ID, temporaryPassword: "short" });

    // Assert
    await expect(reset).rejects.toThrow(PasswordPolicyError);
    expect(await credentials.getPasswordHash(AGENT_ID)).toBe(OLD_PASSWORD_HASH);
    expect(await users.findById(AGENT_ID)).toEqual(AGENT_RECORD);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });

  it("rejects an unknown user with UserNotFoundError and revokes no sessions", async () => {
    // Arrange
    const { sessionRevoker, resetUserPassword } = await setUp();

    // Act
    const reset = resetUserPassword({
      actor: ADMIN_ACTOR,
      userId: "missing-user",
      temporaryPassword: TEMPORARY_PASSWORD,
    });

    // Assert
    await expect(reset).rejects.toThrow(UserNotFoundError);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });

  it("rejects an agent actor with ForbiddenError, changes nothing and revokes no sessions", async () => {
    // Arrange
    const { users, credentials, sessionRevoker, resetUserPassword } = await setUp();

    // Act
    const reset = resetUserPassword({ actor: AGENT_ACTOR, userId: AGENT_ID, temporaryPassword: TEMPORARY_PASSWORD });

    // Assert
    await expect(reset).rejects.toThrow(ForbiddenError);
    expect(await credentials.getPasswordHash(AGENT_ID)).toBe(OLD_PASSWORD_HASH);
    expect(await users.findById(AGENT_ID)).toEqual(AGENT_RECORD);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });
});
