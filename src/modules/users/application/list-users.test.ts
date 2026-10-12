import { describe, expect, it } from "vitest";

import type { Actor } from "@/modules/users/domain/actor";
import { ForbiddenError } from "@/modules/users/domain/errors";
import type { User } from "@/modules/users/domain/user";

import { makeListUsers } from "./list-users";
import { buildUser } from "./testing/build-user";
import { InMemoryUserRepository } from "./testing/in-memory-user-repository";

const ADMIN_ACTOR: Actor = { id: "admin-carla", role: "admin" };
const AGENT_ACTOR: Actor = { id: "agent-bruno", role: "agent" };

function setUp() {
  const userRepository = new InMemoryUserRepository();
  userRepository.seed(
    buildUser({ id: "agent-diego", name: "Diego Ruiz", email: "diego@example.com", role: "agent", status: "inactive" }),
  );
  userRepository.seed(
    buildUser({ id: ADMIN_ACTOR.id, name: "Carla Admin", email: "carla@example.com", role: "admin", status: "active" }),
  );
  userRepository.seed(
    buildUser({ id: AGENT_ACTOR.id, name: "Bruno Agent", email: "bruno@sales.example.com", role: "agent" }),
  );
  userRepository.seed(
    buildUser({
      id: "agent-ana",
      name: "Ana López",
      email: "ana@sales.example.com",
      role: "agent",
      status: "active",
      mustChangePassword: true,
    }),
  );
  const listUsers = makeListUsers({ userRepository });
  return { listUsers };
}

function namesOf(users: User[]): string[] {
  return users.map((user) => user.name);
}

describe("listUsers", () => {
  it("returns every user sorted by name when there are no filters", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({ actor: ADMIN_ACTOR, filters: {} });

    // Assert
    expect(namesOf(users)).toEqual(["Ana López", "Bruno Agent", "Carla Admin", "Diego Ruiz"]);
  });

  it("finds users by part of the name, ignoring case", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({ actor: ADMIN_ACTOR, filters: { search: "rUIz" } });

    // Assert
    expect(namesOf(users)).toEqual(["Diego Ruiz"]);
  });

  it("finds users by part of the email, ignoring case", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({ actor: ADMIN_ACTOR, filters: { search: "SALES.Example" } });

    // Assert
    expect(namesOf(users)).toEqual(["Ana López", "Bruno Agent"]);
  });

  it("combines search, role and status filters", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({
      actor: ADMIN_ACTOR,
      filters: { search: "example.com", role: "agent", status: "active" },
    });

    // Assert: Ana is active but must change her password, so her label is not "Activo".
    expect(namesOf(users)).toEqual(["Bruno Agent"]);
  });

  it("filters users who must change their password", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({ actor: ADMIN_ACTOR, filters: { status: "must_change_password" } });

    // Assert
    expect(namesOf(users)).toEqual(["Ana López"]);
  });

  it("treats a search made only of spaces as no search", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({ actor: ADMIN_ACTOR, filters: { search: "   " } });

    // Assert
    expect(users).toHaveLength(4);
  });

  it("trims spaces around the search text", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({ actor: ADMIN_ACTOR, filters: { search: "  diego  " } });

    // Assert
    expect(namesOf(users)).toEqual(["Diego Ruiz"]);
  });

  it("returns an empty list when nothing matches", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const users = await listUsers({ actor: ADMIN_ACTOR, filters: { search: "nobody", role: "admin" } });

    // Assert
    expect(users).toEqual([]);
  });

  it("rejects an agent actor with ForbiddenError", async () => {
    // Arrange
    const { listUsers } = setUp();

    // Act
    const listing = listUsers({ actor: AGENT_ACTOR, filters: {} });

    // Assert
    await expect(listing).rejects.toThrow(ForbiddenError);
  });
});
