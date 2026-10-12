import { describe, expect, it } from "vitest";

import type { Actor } from "@/modules/users/domain/actor";
import {
  CannotModifyOwnAccountError,
  ForbiddenError,
  LastActiveAdminError,
  UserNotFoundError,
} from "@/modules/users/domain/errors";

import { makeDeactivateUser } from "./deactivate-user";
import { buildUser } from "./testing/build-user";
import { InMemoryCredentialRepository } from "./testing/in-memory-credential-repository";
import { InMemoryUserRepository, InMemoryUserTransactionRunner } from "./testing/in-memory-user-repository";
import { SpySessionRevoker } from "./testing/spy-session-revoker";

const ADMIN_ACTOR: Actor = { id: "admin-actor", role: "admin" };
const AGENT_ACTOR: Actor = { id: "agent-actor", role: "agent" };
const OTHER_ADMIN_ID = "other-admin";
const AGENT_ID = "bruno-agent";

const ACTOR_RECORD = buildUser({ id: ADMIN_ACTOR.id, name: "Ana Admin", email: "ana@example.com", role: "admin" });
const OTHER_ADMIN_RECORD = buildUser({ id: OTHER_ADMIN_ID, name: "Carla Admin", email: "carla@example.com", role: "admin" });
const AGENT_RECORD = buildUser({ id: AGENT_ID, name: "Bruno Agent", email: "bruno@example.com", role: "agent" });

/** Builds the use case over the given users, with a spy that records revoked sessions. */
function makeUseCase(users: InMemoryUserRepository) {
  const sessionRevoker = new SpySessionRevoker();
  const deactivateUser = makeDeactivateUser({
    transactionRunner: new InMemoryUserTransactionRunner(users, new InMemoryCredentialRepository()),
    sessionRevoker,
  });
  return { sessionRevoker, deactivateUser };
}

/** Seeds two active admins (the actor and another one) and one agent. */
function setUp() {
  const users = new InMemoryUserRepository();
  users.seed(ACTOR_RECORD);
  users.seed(OTHER_ADMIN_RECORD);
  users.seed(AGENT_RECORD);
  return { users, ...makeUseCase(users) };
}

describe("deactivateUser", () => {
  it("deactivates another user and revokes all their sessions", async () => {
    // Arrange
    const { users, sessionRevoker, deactivateUser } = setUp();

    // Act
    await deactivateUser({ actor: ADMIN_ACTOR, userId: AGENT_ID });

    // Assert
    expect((await users.findById(AGENT_ID))?.status).toBe("inactive");
    expect(sessionRevoker.revokedAllForUser).toEqual([AGENT_ID]);
  });

  it("lets an admin deactivate another admin while another active admin remains", async () => {
    // Arrange
    const { users, sessionRevoker, deactivateUser } = setUp();

    // Act
    await deactivateUser({ actor: ADMIN_ACTOR, userId: OTHER_ADMIN_ID });

    // Assert
    expect((await users.findById(OTHER_ADMIN_ID))?.status).toBe("inactive");
    expect(sessionRevoker.revokedAllForUser).toEqual([OTHER_ADMIN_ID]);
  });

  it("rejects an admin deactivating themselves, changes nothing and revokes no sessions", async () => {
    // Arrange
    const { users, sessionRevoker, deactivateUser } = setUp();

    // Act
    const deactivation = deactivateUser({ actor: ADMIN_ACTOR, userId: ADMIN_ACTOR.id });

    // Assert
    await expect(deactivation).rejects.toThrow(CannotModifyOwnAccountError);
    expect(await users.findById(ADMIN_ACTOR.id)).toEqual(ACTOR_RECORD);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });

  it("rejects deactivating the last active admin, changes nothing and revokes no sessions", async () => {
    // Arrange
    // Real-world situation (spec §12): Ana and Carla, the only two admins,
    // deactivate each other at the same time. Carla's request committed
    // first, so Ana is already stored as inactive. Ana's request was
    // authorized before that commit, so her actor still says "admin". Inside
    // her transaction the lock sees only one active admin (Carla), and
    // deactivating Carla must be rejected so one active admin always remains
    // (BR-008).
    const users = new InMemoryUserRepository();
    users.seed({ ...ACTOR_RECORD, status: "inactive" });
    users.seed(OTHER_ADMIN_RECORD);
    const { sessionRevoker, deactivateUser } = makeUseCase(users);

    // Act
    const deactivation = deactivateUser({ actor: ADMIN_ACTOR, userId: OTHER_ADMIN_ID });

    // Assert
    await expect(deactivation).rejects.toThrow(LastActiveAdminError);
    expect(await users.findById(OTHER_ADMIN_ID)).toEqual(OTHER_ADMIN_RECORD);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });

  it("leaves an already inactive user inactive without an error", async () => {
    // Arrange
    const { users, deactivateUser } = setUp();
    await deactivateUser({ actor: ADMIN_ACTOR, userId: AGENT_ID });

    // Act
    await deactivateUser({ actor: ADMIN_ACTOR, userId: AGENT_ID });

    // Assert
    expect((await users.findById(AGENT_ID))?.status).toBe("inactive");
  });

  it("rejects an unknown user with UserNotFoundError and revokes no sessions", async () => {
    // Arrange
    const { sessionRevoker, deactivateUser } = setUp();

    // Act
    const deactivation = deactivateUser({ actor: ADMIN_ACTOR, userId: "missing-user" });

    // Assert
    await expect(deactivation).rejects.toThrow(UserNotFoundError);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });

  it("rejects an agent actor with ForbiddenError, changes nothing and revokes no sessions", async () => {
    // Arrange
    const { users, sessionRevoker, deactivateUser } = setUp();

    // Act
    const deactivation = deactivateUser({ actor: AGENT_ACTOR, userId: AGENT_ID });

    // Assert
    await expect(deactivation).rejects.toThrow(ForbiddenError);
    expect(await users.findById(AGENT_ID)).toEqual(AGENT_RECORD);
    expect(sessionRevoker.revokedAllForUser).toEqual([]);
  });
});
