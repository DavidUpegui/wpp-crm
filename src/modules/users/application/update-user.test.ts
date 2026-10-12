import { describe, expect, it } from "vitest";

import type { Actor } from "@/modules/users/domain/actor";
import {
  CannotModifyOwnAccountError,
  ForbiddenError,
  LastActiveAdminError,
  UserNotFoundError,
} from "@/modules/users/domain/errors";

import { makeUpdateUser } from "./update-user";
import { buildUser } from "./testing/build-user";
import { InMemoryCredentialRepository } from "./testing/in-memory-credential-repository";
import { InMemoryUserRepository, InMemoryUserTransactionRunner } from "./testing/in-memory-user-repository";

const ADMIN_ACTOR: Actor = { id: "admin-actor", role: "admin" };
const AGENT_ACTOR: Actor = { id: "agent-actor", role: "agent" };
const OTHER_ADMIN_ID = "other-admin";
const AGENT_ID = "bruno-agent";

const ACTOR_RECORD = buildUser({ id: ADMIN_ACTOR.id, name: "Ana Admin", email: "ana@example.com", role: "admin" });
const OTHER_ADMIN_RECORD = buildUser({ id: OTHER_ADMIN_ID, name: "Carla Admin", email: "carla@example.com", role: "admin" });
const AGENT_RECORD = buildUser({ id: AGENT_ID, name: "Bruno Agent", email: "bruno@example.com", role: "agent" });

/** Seeds two active admins (the actor and another one) and one agent. */
function setUp() {
  const users = new InMemoryUserRepository();
  const credentials = new InMemoryCredentialRepository();
  users.seed(ACTOR_RECORD);
  users.seed(OTHER_ADMIN_RECORD);
  users.seed(AGENT_RECORD);
  const updateUser = makeUpdateUser({
    transactionRunner: new InMemoryUserTransactionRunner(users, credentials),
  });
  return { users, updateUser };
}

describe("updateUser", () => {
  it("renames another user and changes their role", async () => {
    // Arrange
    const { users, updateUser } = setUp();

    // Act
    const updatedUser = await updateUser({ actor: ADMIN_ACTOR, userId: AGENT_ID, name: "Bruno Lead", role: "admin" });

    // Assert
    expect(updatedUser.name).toBe("Bruno Lead");
    expect(updatedUser.role).toBe("admin");
    const storedUser = await users.findById(AGENT_ID);
    expect(storedUser?.name).toBe("Bruno Lead");
    expect(storedUser?.role).toBe("admin");
  });

  it("lets an admin demote another admin while another active admin remains", async () => {
    // Arrange
    const { users, updateUser } = setUp();

    // Act
    await updateUser({ actor: ADMIN_ACTOR, userId: OTHER_ADMIN_ID, name: "Carla Admin", role: "agent" });

    // Assert
    expect((await users.findById(OTHER_ADMIN_ID))?.role).toBe("agent");
  });

  it("lets an admin rename themselves when the role stays the same", async () => {
    // Arrange
    const { users, updateUser } = setUp();

    // Act
    await updateUser({ actor: ADMIN_ACTOR, userId: ADMIN_ACTOR.id, name: "Ana Pérez", role: "admin" });

    // Assert
    const storedActor = await users.findById(ADMIN_ACTOR.id);
    expect(storedActor?.name).toBe("Ana Pérez");
    expect(storedActor?.role).toBe("admin");
  });

  it("rejects an admin changing their own role and changes nothing", async () => {
    // Arrange
    const { users, updateUser } = setUp();

    // Act
    const update = updateUser({ actor: ADMIN_ACTOR, userId: ADMIN_ACTOR.id, name: "Renamed", role: "agent" });

    // Assert
    await expect(update).rejects.toThrow(CannotModifyOwnAccountError);
    expect(await users.findById(ADMIN_ACTOR.id)).toEqual(ACTOR_RECORD);
  });

  it("rejects demoting the last active admin and changes nothing", async () => {
    // Arrange
    // Real-world situation (spec §12): Ana and Carla, the only two admins,
    // demote each other at the same time. Carla's request committed first,
    // so Ana is already stored as an agent. Ana's request was authorized
    // before that commit, so her actor still says "admin". Inside her
    // transaction the lock sees only one active admin (Carla), and demoting
    // Carla must be rejected so one active admin always remains (BR-008).
    const users = new InMemoryUserRepository();
    users.seed({ ...ACTOR_RECORD, role: "agent" });
    users.seed(OTHER_ADMIN_RECORD);
    const updateUser = makeUpdateUser({
      transactionRunner: new InMemoryUserTransactionRunner(users, new InMemoryCredentialRepository()),
    });

    // Act
    const update = updateUser({ actor: ADMIN_ACTOR, userId: OTHER_ADMIN_ID, name: "Renamed", role: "agent" });

    // Assert
    await expect(update).rejects.toThrow(LastActiveAdminError);
    expect(await users.findById(OTHER_ADMIN_ID)).toEqual(OTHER_ADMIN_RECORD);
  });

  it("trims the new name", async () => {
    // Arrange
    const { updateUser } = setUp();

    // Act
    const updatedUser = await updateUser({ actor: ADMIN_ACTOR, userId: AGENT_ID, name: "  Bruno Lead  ", role: "agent" });

    // Assert
    expect(updatedUser.name).toBe("Bruno Lead");
  });

  it("never changes the email, because the input has no email field", async () => {
    // Arrange
    const { users, updateUser } = setUp();

    // Act
    await updateUser({
      actor: ADMIN_ACTOR,
      userId: AGENT_ID,
      name: "Bruno Lead",
      role: "agent",
      // @ts-expect-error -- BR-010: the email cannot be changed, so the input does not accept it.
      email: "new.email@example.com",
    });

    // Assert
    expect((await users.findById(AGENT_ID))?.email).toBe(AGENT_RECORD.email);
  });

  it("rejects an unknown user with UserNotFoundError", async () => {
    // Arrange
    const { updateUser } = setUp();

    // Act
    const update = updateUser({ actor: ADMIN_ACTOR, userId: "missing-user", name: "Nobody", role: "agent" });

    // Assert
    await expect(update).rejects.toThrow(UserNotFoundError);
  });

  it("rejects an agent actor with ForbiddenError and changes nothing", async () => {
    // Arrange
    const { users, updateUser } = setUp();

    // Act
    const update = updateUser({ actor: AGENT_ACTOR, userId: AGENT_ID, name: "Renamed", role: "admin" });

    // Assert
    await expect(update).rejects.toThrow(ForbiddenError);
    expect(await users.findById(AGENT_ID)).toEqual(AGENT_RECORD);
  });
});
