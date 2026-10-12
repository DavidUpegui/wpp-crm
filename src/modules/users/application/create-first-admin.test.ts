import { describe, expect, it } from "vitest";

import { FirstAdminAlreadyExistsError, PasswordPolicyError } from "@/modules/users/domain/errors";

import { makeCreateFirstAdmin } from "./create-first-admin";
import { buildUser } from "./testing/build-user";
import { FakePasswordHasher } from "./testing/fake-password-hasher";
import { InMemoryCredentialRepository } from "./testing/in-memory-credential-repository";
import { InMemoryUserRepository, InMemoryUserTransactionRunner } from "./testing/in-memory-user-repository";

const VALID_PASSWORD = "first-admin-password";
const VALID_INPUT = { name: "Ana Admin", email: "ana@example.com", password: VALID_PASSWORD };

function setUp() {
  const users = new InMemoryUserRepository();
  const credentials = new InMemoryCredentialRepository();
  const createFirstAdmin = makeCreateFirstAdmin({
    transactionRunner: new InMemoryUserTransactionRunner(users, credentials),
    passwordHasher: new FakePasswordHasher(),
  });
  return { users, credentials, createFirstAdmin };
}

describe("createFirstAdmin", () => {
  it("creates an active admin who must change the password", async () => {
    // Arrange
    const { createFirstAdmin } = setUp();

    // Act
    const admin = await createFirstAdmin(VALID_INPUT);

    // Assert
    expect(admin.role).toBe("admin");
    expect(admin.status).toBe("active");
    expect(admin.mustChangePassword).toBe(true);
  });

  it("stores only the hashed password", async () => {
    // Arrange
    const { credentials, createFirstAdmin } = setUp();

    // Act
    const admin = await createFirstAdmin(VALID_INPUT);

    // Assert
    expect(await credentials.getPasswordHash(admin.id)).toBe(`hashed:${VALID_PASSWORD}`);
  });

  it("normalizes the email and trims the name", async () => {
    // Arrange
    const { users, createFirstAdmin } = setUp();

    // Act
    const admin = await createFirstAdmin({ ...VALID_INPUT, name: "  Ana Admin  ", email: "  Ana@Example.COM " });

    // Assert
    expect(admin.name).toBe("Ana Admin");
    expect(admin.email).toBe("ana@example.com");
    expect(await users.findByEmail("ana@example.com")).not.toBeNull();
  });

  it("refuses when an admin already exists and creates nothing", async () => {
    // Arrange
    const { users, createFirstAdmin } = setUp();
    users.seed(buildUser({ id: "existing-admin", email: "boss@example.com", role: "admin" }));

    // Act
    const creation = createFirstAdmin(VALID_INPUT);

    // Assert
    await expect(creation).rejects.toThrow(FirstAdminAlreadyExistsError);
    expect(await users.list({})).toHaveLength(1);
  });

  it("also refuses when the only existing admin is inactive", async () => {
    // Arrange
    const { users, createFirstAdmin } = setUp();
    users.seed(buildUser({ id: "inactive-admin", email: "boss@example.com", role: "admin", status: "inactive" }));

    // Act
    const creation = createFirstAdmin(VALID_INPUT);

    // Assert
    await expect(creation).rejects.toThrow(FirstAdminAlreadyExistsError);
    expect(await users.list({})).toHaveLength(1);
  });

  it("creates the first admin even when an agent already exists", async () => {
    // Arrange
    const { users, createFirstAdmin } = setUp();
    users.seed(buildUser({ id: "existing-agent", email: "agent@example.com", role: "agent" }));

    // Act
    const admin = await createFirstAdmin(VALID_INPUT);

    // Assert
    expect(admin.role).toBe("admin");
    expect(await users.countAdmins()).toBe(1);
  });

  it("rejects a password shorter than 10 characters and creates nothing", async () => {
    // Arrange
    const { users, credentials, createFirstAdmin } = setUp();

    // Act
    const creation = createFirstAdmin({ ...VALID_INPUT, password: "short" });

    // Assert
    await expect(creation).rejects.toThrow(PasswordPolicyError);
    expect(await users.list({})).toHaveLength(0);
    expect(await credentials.getPasswordHash("user-1")).toBeNull();
  });
});
