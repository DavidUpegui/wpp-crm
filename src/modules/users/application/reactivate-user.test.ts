import { describe, expect, it } from "vitest";

import type { Actor } from "@/modules/users/domain/actor";
import { ForbiddenError, UserNotFoundError } from "@/modules/users/domain/errors";

import { makeReactivateUser } from "./reactivate-user";
import { buildUser } from "./testing/build-user";
import { InMemoryCredentialRepository } from "./testing/in-memory-credential-repository";
import { InMemoryUserRepository } from "./testing/in-memory-user-repository";

const ADMIN_ACTOR: Actor = { id: "admin-actor", role: "admin" };
const AGENT_ACTOR: Actor = { id: "agent-actor", role: "agent" };
const INACTIVE_USER_ID = "bruno-inactive";
const EXISTING_PASSWORD_HASH = "hashed:existing-password";

const INACTIVE_USER_RECORD = buildUser({
  id: INACTIVE_USER_ID,
  name: "Bruno Agent",
  email: "bruno@example.com",
  status: "inactive",
});

/** Seeds one inactive user who already has a password. */
async function setUp() {
  const users = new InMemoryUserRepository();
  const credentials = new InMemoryCredentialRepository();
  users.seed(INACTIVE_USER_RECORD);
  await credentials.createForUser(INACTIVE_USER_ID, EXISTING_PASSWORD_HASH);
  const reactivateUser = makeReactivateUser({ userRepository: users });
  return { users, credentials, reactivateUser };
}

describe("reactivateUser", () => {
  it("reactivates an inactive user", async () => {
    // Arrange
    const { users, reactivateUser } = await setUp();

    // Act
    await reactivateUser({ actor: ADMIN_ACTOR, userId: INACTIVE_USER_ID });

    // Assert
    expect((await users.findById(INACTIVE_USER_ID))?.status).toBe("active");
  });

  it("keeps the user's existing password", async () => {
    // Arrange
    const { credentials, reactivateUser } = await setUp();

    // Act
    await reactivateUser({ actor: ADMIN_ACTOR, userId: INACTIVE_USER_ID });

    // Assert
    // AC-9.2: the user logs in again with the password they already had.
    expect(await credentials.getPasswordHash(INACTIVE_USER_ID)).toBe(EXISTING_PASSWORD_HASH);
  });

  it("rejects an unknown user with UserNotFoundError", async () => {
    // Arrange
    const { reactivateUser } = await setUp();

    // Act
    const reactivation = reactivateUser({ actor: ADMIN_ACTOR, userId: "missing-user" });

    // Assert
    await expect(reactivation).rejects.toThrow(UserNotFoundError);
  });

  it("rejects an agent actor with ForbiddenError and changes nothing", async () => {
    // Arrange
    const { users, reactivateUser } = await setUp();

    // Act
    const reactivation = reactivateUser({ actor: AGENT_ACTOR, userId: INACTIVE_USER_ID });

    // Assert
    await expect(reactivation).rejects.toThrow(ForbiddenError);
    expect(await users.findById(INACTIVE_USER_ID)).toEqual(INACTIVE_USER_RECORD);
  });
});
