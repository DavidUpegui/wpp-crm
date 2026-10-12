// Proves the in-memory fakes honor the same contract as the real
// implementations (AGENTS.md §5.3 L), because every use case test relies on it.

import { describe, expect, it } from "vitest";

import { EmailAlreadyInUseError, UserNotFoundError } from "@/modules/users/domain/errors";

import { buildUser } from "./build-user";
import { InMemoryCredentialRepository } from "./in-memory-credential-repository";
import { InMemoryUserRepository, InMemoryUserTransactionRunner } from "./in-memory-user-repository";

const FIXED_NOW = new Date("2026-05-01T12:00:00.000Z");

class SimulatedFailureError extends Error {}

describe("InMemoryUserRepository", () => {
  it("creates an active user with a readable id, no last login and clock timestamps", async () => {
    // Arrange
    const repository = new InMemoryUserRepository({ now: () => FIXED_NOW });

    // Act
    const user = await repository.create({
      name: "Ana",
      email: "ana@example.com",
      role: "agent",
      mustChangePassword: true,
    });

    // Assert
    expect(user).toEqual({
      id: "user-1",
      name: "Ana",
      email: "ana@example.com",
      role: "agent",
      status: "active",
      mustChangePassword: true,
      lastLoginAt: null,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
  });

  it("rejects creating a user whose email differs from an existing one only by case", async () => {
    // Arrange
    const repository = new InMemoryUserRepository();
    repository.seed(buildUser({ id: "existing", email: "ana@example.com" }));

    // Act
    const creation = repository.create({
      name: "Other Ana",
      email: "ANA@Example.com",
      role: "agent",
      mustChangePassword: false,
    });

    // Assert
    await expect(creation).rejects.toThrow(EmailAlreadyInUseError);
  });

  it("throws UserNotFoundError when updating a user that does not exist", async () => {
    // Arrange
    const repository = new InMemoryUserRepository();

    // Act + Assert
    await expect(repository.updateName("missing", "New name")).rejects.toThrow(UserNotFoundError);
    await expect(repository.setStatus("missing", "inactive")).rejects.toThrow(UserNotFoundError);
  });

  it("returns copies, so changing a returned user does not change the stored one", async () => {
    // Arrange
    const repository = new InMemoryUserRepository();
    repository.seed(buildUser({ id: "ana", name: "Ana" }));
    const returnedUser = await repository.findById("ana");

    // Act
    returnedUser!.name = "Changed by accident";

    // Assert
    expect((await repository.findById("ana"))?.name).toBe("Ana");
  });

  it("filters by the displayed status, where inactive wins over a pending password change", async () => {
    // Arrange
    const repository = new InMemoryUserRepository();
    repository.seed(buildUser({ id: "regular", email: "regular@example.com" }));
    repository.seed(buildUser({ id: "temporary", email: "temporary@example.com", mustChangePassword: true }));
    repository.seed(buildUser({ id: "disabled", email: "disabled@example.com", status: "inactive" }));
    repository.seed(
      buildUser({
        id: "disabled-temporary",
        email: "disabled.temporary@example.com",
        status: "inactive",
        mustChangePassword: true,
      }),
    );

    // Act
    const active = await repository.list({ status: "active" });
    const mustChange = await repository.list({ status: "must_change_password" });
    const inactive = await repository.list({ status: "inactive" });

    // Assert
    expect(active.map((user) => user.id)).toEqual(["regular"]);
    expect(mustChange.map((user) => user.id)).toEqual(["temporary"]);
    expect(inactive.map((user) => user.id).sort()).toEqual(["disabled", "disabled-temporary"]);
  });

  it("searches name or email case-insensitively, combines with role and sorts by name", async () => {
    // Arrange
    const repository = new InMemoryUserRepository();
    repository.seed(buildUser({ id: "zoe", name: "Zoe", email: "zoe@acme.com", role: "admin" }));
    repository.seed(buildUser({ id: "bruno", name: "Bruno ACME", email: "bruno@example.com", role: "admin" }));
    repository.seed(buildUser({ id: "carla", name: "Carla", email: "carla@acme.com", role: "agent" }));

    // Act
    const users = await repository.list({ search: "Acme", role: "admin" });

    // Assert
    expect(users.map((user) => user.id)).toEqual(["bruno", "zoe"]);
  });

  it("counts admins of any status but locks only active admins", async () => {
    // Arrange
    const repository = new InMemoryUserRepository();
    repository.seed(buildUser({ id: "active-admin", email: "a@example.com", role: "admin" }));
    repository.seed(buildUser({ id: "inactive-admin", email: "b@example.com", role: "admin", status: "inactive" }));
    repository.seed(buildUser({ id: "agent", email: "c@example.com" }));

    // Act + Assert
    expect(await repository.countAdmins()).toBe(2);
    expect(await repository.lockActiveAdmins()).toBe(1);
  });
});

describe("InMemoryCredentialRepository", () => {
  it("refuses to create a second credential for the same user", async () => {
    // Arrange
    const credentials = new InMemoryCredentialRepository();
    await credentials.createForUser("ana", "first-hash");

    // Act + Assert
    await expect(credentials.createForUser("ana", "other-hash")).rejects.toThrow("credential already exists");
    expect(await credentials.getPasswordHash("ana")).toBe("first-hash");
  });

  it("throws UserNotFoundError when replacing the hash of a user without a credential", async () => {
    // Arrange
    const credentials = new InMemoryCredentialRepository();

    // Act + Assert
    await expect(credentials.setPasswordHash("missing", "hash")).rejects.toThrow(UserNotFoundError);
  });
});

describe("InMemoryUserTransactionRunner", () => {
  it("restores users and credentials when the work throws, then rethrows the error", async () => {
    // Arrange
    const users = new InMemoryUserRepository();
    const credentials = new InMemoryCredentialRepository();
    users.seed(buildUser({ id: "ana", name: "Ana" }));
    await credentials.createForUser("ana", "old-hash");
    const runner = new InMemoryUserTransactionRunner(users, credentials);

    // Act
    const transaction = runner.run(async (repositories) => {
      await repositories.users.updateName("ana", "Renamed");
      await repositories.credentials.setPasswordHash("ana", "new-hash");
      throw new SimulatedFailureError();
    });

    // Assert
    await expect(transaction).rejects.toThrow(SimulatedFailureError);
    expect((await users.findById("ana"))?.name).toBe("Ana");
    expect(await credentials.getPasswordHash("ana")).toBe("old-hash");
  });

  it("keeps the changes and returns the result when the work succeeds", async () => {
    // Arrange
    const users = new InMemoryUserRepository();
    const credentials = new InMemoryCredentialRepository();
    const runner = new InMemoryUserTransactionRunner(users, credentials);

    // Act
    const createdUser = await runner.run(async (repositories) => {
      const user = await repositories.users.create({
        name: "Ana",
        email: "ana@example.com",
        role: "agent",
        mustChangePassword: true,
      });
      await repositories.credentials.createForUser(user.id, "hash");
      return user;
    });

    // Assert
    expect(await users.findById(createdUser.id)).not.toBeNull();
    expect(await credentials.getPasswordHash(createdUser.id)).toBe("hash");
  });
});
