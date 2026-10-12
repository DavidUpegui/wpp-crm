import { describe, expect, it, vi } from "vitest";

import type { Actor } from "@/modules/users/domain/actor";
import { EmailAlreadyInUseError, ForbiddenError, PasswordPolicyError } from "@/modules/users/domain/errors";

import { makeCreateUser } from "./create-user";
import { buildUser } from "./testing/build-user";
import { FakePasswordHasher } from "./testing/fake-password-hasher";
import { InMemoryCredentialRepository } from "./testing/in-memory-credential-repository";
import { InMemoryUserRepository, InMemoryUserTransactionRunner } from "./testing/in-memory-user-repository";

const ADMIN_ACTOR: Actor = { id: "admin-actor", role: "admin" };
const AGENT_ACTOR: Actor = { id: "agent-actor", role: "agent" };
const TEMPORARY_PASSWORD = "temporary-password";
const VALID_INPUT = {
  actor: ADMIN_ACTOR,
  name: "Bruno Agent",
  email: "bruno@example.com",
  role: "agent" as const,
  temporaryPassword: TEMPORARY_PASSWORD,
};

function setUp() {
  const users = new InMemoryUserRepository();
  const credentials = new InMemoryCredentialRepository();
  const passwordHasher = new FakePasswordHasher();
  users.seed(buildUser({ id: ADMIN_ACTOR.id, email: "admin@example.com", role: "admin" }));
  const createUser = makeCreateUser({
    transactionRunner: new InMemoryUserTransactionRunner(users, credentials),
    passwordHasher,
  });
  return { users, credentials, passwordHasher, createUser };
}

describe("createUser", () => {
  it("creates an active user with a temporary password", async () => {
    // Arrange
    const { credentials, createUser } = setUp();

    // Act
    const user = await createUser(VALID_INPUT);

    // Assert
    expect(user.status).toBe("active");
    expect(user.mustChangePassword).toBe(true);
    expect(await credentials.getPasswordHash(user.id)).toBe(`hashed:${TEMPORARY_PASSWORD}`);
  });

  it("normalizes the email and trims the name", async () => {
    // Arrange
    const { users, createUser } = setUp();

    // Act
    const user = await createUser({ ...VALID_INPUT, name: "  Bruno Agent  ", email: "  Bruno@Example.COM " });

    // Assert
    expect(user.name).toBe("Bruno Agent");
    expect(user.email).toBe("bruno@example.com");
    expect(await users.findByEmail("bruno@example.com")).not.toBeNull();
  });

  it("can create admins and agents, keeping the chosen role", async () => {
    // Arrange
    const { createUser } = setUp();

    // Act
    const admin = await createUser({ ...VALID_INPUT, email: "new.admin@example.com", role: "admin" });
    const agent = await createUser({ ...VALID_INPUT, email: "new.agent@example.com", role: "agent" });

    // Assert
    expect(admin.role).toBe("admin");
    expect(agent.role).toBe("agent");
  });

  it("rejects an email already used by another user, ignoring case, and stores nothing new", async () => {
    // Arrange
    const { users, credentials, createUser } = setUp();
    users.seed(buildUser({ id: "existing", email: "bruno@example.com" }));

    // Act
    const creation = createUser({ ...VALID_INPUT, email: "BRUNO@example.com" });

    // Assert
    await expect(creation).rejects.toThrow(EmailAlreadyInUseError);
    expect(await users.list({})).toHaveLength(2);
    expect(await credentials.getPasswordHash("user-1")).toBeNull();
  });

  it("creates only one user when the same user is submitted twice", async () => {
    // Arrange
    const { users, createUser } = setUp();
    await createUser(VALID_INPUT);

    // Act
    const secondCreation = createUser(VALID_INPUT);

    // Assert
    await expect(secondCreation).rejects.toThrow(EmailAlreadyInUseError);
    const matchingUsers = (await users.list({})).filter((user) => user.email === "bruno@example.com");
    expect(matchingUsers).toHaveLength(1);
  });

  it("rejects a weak temporary password and stores nothing", async () => {
    // Arrange
    const { users, credentials, createUser } = setUp();

    // Act
    const creation = createUser({ ...VALID_INPUT, temporaryPassword: "short" });

    // Assert
    await expect(creation).rejects.toThrow(PasswordPolicyError);
    expect(await users.list({})).toHaveLength(1);
    expect(await credentials.getPasswordHash("user-1")).toBeNull();
  });

  it("rejects an agent actor before even hashing the password, and stores nothing", async () => {
    // Arrange
    const { users, credentials, passwordHasher, createUser } = setUp();
    const hashSpy = vi.spyOn(passwordHasher, "hash");

    // Act
    const creation = createUser({ ...VALID_INPUT, actor: AGENT_ACTOR });

    // Assert
    await expect(creation).rejects.toThrow(ForbiddenError);
    expect(hashSpy).not.toHaveBeenCalled();
    expect(await users.list({})).toHaveLength(1);
    expect(await credentials.getPasswordHash("user-1")).toBeNull();
  });
});
