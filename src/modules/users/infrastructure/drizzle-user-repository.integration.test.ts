// Integration tests for the Drizzle users and credentials repositories, against the real
// Postgres test database (`pnpm test:integration`).

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { EmailAlreadyInUseError, UserNotFoundError } from "@/modules/users/domain/errors";
import type { User } from "@/modules/users/domain/user";
import type { NewUser } from "@/modules/users/domain/user-repository";
import { user as userTable } from "@/shared/db/schema";
import { createTestDatabase, resetAuthTables } from "../../../../tests/integration/test-database";

import { DrizzleCredentialRepository } from "./drizzle-credential-repository";
import { DrizzleUserRepository } from "./drizzle-user-repository";

const MISSING_USER_ID = "00000000-0000-0000-0000-000000000000";

const testDatabase = createTestDatabase();
const users = new DrizzleUserRepository(testDatabase.database);
const credentials = new DrizzleCredentialRepository(testDatabase.database);

beforeEach(async () => {
  await resetAuthTables(testDatabase.database);
});

afterAll(async () => {
  await testDatabase.close();
});

function createUser(overrides: Partial<NewUser> = {}): Promise<User> {
  return users.create({
    name: "Test User",
    email: "test.user@example.com",
    role: "agent",
    mustChangePassword: false,
    ...overrides,
  });
}

function namesOf(list: User[]): string[] {
  return list.map((user) => user.name);
}

describe("DrizzleUserRepository", () => {
  it("creates an active user that can be found by id and by email", async () => {
    // Arrange + Act
    const created = await createUser({ name: "Ana", email: "ana@example.com", role: "admin", mustChangePassword: true });

    // Assert
    expect(created).toMatchObject({
      name: "Ana",
      email: "ana@example.com",
      role: "admin",
      status: "active",
      mustChangePassword: true,
      lastLoginAt: null,
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(await users.findById(created.id)).toEqual(created);
    expect(await users.findByEmail("ana@example.com")).toEqual(created);
  });

  it("returns null when no user has the id or email", async () => {
    // Act + Assert
    expect(await users.findById(MISSING_USER_ID)).toBeNull();
    expect(await users.findByEmail("nobody@example.com")).toBeNull();
  });

  it("rejects a duplicate email even when it differs only by case", async () => {
    // Arrange
    await createUser({ email: "ana@x.com" });

    // Act + Assert
    await expect(createUser({ email: "ana@x.com" })).rejects.toThrow(EmailAlreadyInUseError);
    await expect(createUser({ email: "ANA@x.com" })).rejects.toThrow(EmailAlreadyInUseError);
  });

  it("rejects a new email that matches a stored mixed-case email (lower(email) index)", async () => {
    // Arrange: a mixed-case email that slipped in without normalization.
    await testDatabase.database.insert(userTable).values({ id: "legacy", name: "Legacy", email: "Bea@X.com" });

    // Act + Assert
    await expect(createUser({ email: "bea@x.com" })).rejects.toThrow(EmailAlreadyInUseError);
  });

  it("searches name or email case-insensitively and sorts by name", async () => {
    // Arrange
    await createUser({ name: "Zoe", email: "zoe@acme.com" });
    await createUser({ name: "Bruno ACME", email: "bruno@example.com" });
    await createUser({ name: "Carla", email: "carla@example.com" });

    // Act
    const found = await users.list({ search: "Acme" });

    // Assert
    expect(namesOf(found)).toEqual(["Bruno ACME", "Zoe"]);
  });

  it("combines role and status filters", async () => {
    // Arrange
    await createUser({ name: "Active admin", email: "a@example.com", role: "admin" });
    const inactiveAdmin = await createUser({ name: "Inactive admin", email: "b@example.com", role: "admin" });
    await users.setStatus(inactiveAdmin.id, "inactive");
    const inactiveAgent = await createUser({ name: "Inactive agent", email: "c@example.com", role: "agent" });
    await users.setStatus(inactiveAgent.id, "inactive");

    // Act
    const inactiveAdmins = await users.list({ role: "admin", status: "inactive" });
    const activeUsers = await users.list({ status: "active" });

    // Assert
    expect(namesOf(inactiveAdmins)).toEqual(["Inactive admin"]);
    expect(namesOf(activeUsers)).toEqual(["Active admin"]);
  });

  it("filters by the displayed status, where inactive wins over a pending password change", async () => {
    // Arrange
    await createUser({ name: "Regular", email: "regular@example.com", mustChangePassword: false });
    await createUser({ name: "Temporary", email: "temporary@example.com", mustChangePassword: true });
    const disabled = await createUser({ name: "Disabled", email: "disabled@example.com", mustChangePassword: false });
    await users.setStatus(disabled.id, "inactive");
    const disabledTemporary = await createUser({
      name: "Disabled temporary",
      email: "disabled.temporary@example.com",
      mustChangePassword: true,
    });
    await users.setStatus(disabledTemporary.id, "inactive");

    // Act
    const active = await users.list({ status: "active" });
    const mustChange = await users.list({ status: "must_change_password" });
    const inactive = await users.list({ status: "inactive" });

    // Assert
    expect(namesOf(active)).toEqual(["Regular"]);
    expect(namesOf(mustChange)).toEqual(["Temporary"]);
    expect(namesOf(inactive)).toEqual(["Disabled", "Disabled temporary"]);
  });

  it("treats % and _ in the search as plain text", async () => {
    // Arrange
    await createUser({ name: "Promo 50% off", email: "promo@example.com" });
    await createUser({ name: "Promo 500 off", email: "other@example.com" });
    await createUser({ name: "Ana", email: "ana_lopez@example.com" });
    await createUser({ name: "Anax", email: "anaxlopez@example.com" });

    // Act
    const percentResults = await users.list({ search: "50%" });
    const underscoreResults = await users.list({ search: "ana_" });

    // Assert
    expect(namesOf(percentResults)).toEqual(["Promo 50% off"]);
    expect(namesOf(underscoreResults)).toEqual(["Ana"]);
  });

  it("updates name and role, and name alone", async () => {
    // Arrange
    const created = await createUser({ name: "Ana", role: "agent" });

    // Act
    const promoted = await users.updateNameAndRole(created.id, { name: "Ana Admin", role: "admin" });
    const renamed = await users.updateName(created.id, "Ana Final");

    // Assert
    expect(promoted).toMatchObject({ name: "Ana Admin", role: "admin" });
    expect(renamed).toMatchObject({ name: "Ana Final", role: "admin" });
    expect(await users.findById(created.id)).toEqual(renamed);
  });

  it("changes status and the must-change-password flag", async () => {
    // Arrange
    const created = await createUser({ mustChangePassword: false });

    // Act
    await users.setStatus(created.id, "inactive");
    await users.setMustChangePassword(created.id, true);

    // Assert
    expect(await users.findById(created.id)).toMatchObject({ status: "inactive", mustChangePassword: true });
  });

  it("throws UserNotFoundError when changing a user that does not exist", async () => {
    // Act + Assert
    await expect(users.updateNameAndRole(MISSING_USER_ID, { name: "X", role: "agent" })).rejects.toThrow(
      UserNotFoundError,
    );
    await expect(users.updateName(MISSING_USER_ID, "X")).rejects.toThrow(UserNotFoundError);
    await expect(users.setStatus(MISSING_USER_ID, "inactive")).rejects.toThrow(UserNotFoundError);
    await expect(users.setMustChangePassword(MISSING_USER_ID, true)).rejects.toThrow(UserNotFoundError);
    await expect(users.recordLogin(MISSING_USER_ID, new Date())).rejects.toThrow(UserNotFoundError);
  });

  it("stores the exact last login date", async () => {
    // Arrange
    const created = await createUser();
    const loggedInAt = new Date("2026-05-01T12:34:56.789Z");

    // Act
    await users.recordLogin(created.id, loggedInAt);

    // Assert
    expect((await users.findById(created.id))?.lastLoginAt).toEqual(loggedInAt);
  });

  it("counts active and inactive admins, but not agents", async () => {
    // Arrange
    await createUser({ email: "a@example.com", role: "admin" });
    const inactiveAdmin = await createUser({ email: "b@example.com", role: "admin" });
    await users.setStatus(inactiveAdmin.id, "inactive");
    await createUser({ email: "c@example.com", role: "agent" });

    // Act + Assert
    expect(await users.countAdmins()).toBe(2);
  });
});

describe("DrizzleCredentialRepository", () => {
  it("stores the first password hash of a user and returns it", async () => {
    // Arrange
    const created = await createUser();

    // Act
    await credentials.createForUser(created.id, "first-hash");

    // Assert
    expect(await credentials.getPasswordHash(created.id)).toBe("first-hash");
  });

  it("replaces the stored password hash", async () => {
    // Arrange
    const created = await createUser();
    await credentials.createForUser(created.id, "first-hash");

    // Act
    await credentials.setPasswordHash(created.id, "second-hash");

    // Assert
    expect(await credentials.getPasswordHash(created.id)).toBe("second-hash");
  });

  it("throws UserNotFoundError when replacing the hash of a user without a credential", async () => {
    // Arrange
    const created = await createUser();

    // Act + Assert
    await expect(credentials.setPasswordHash(created.id, "hash")).rejects.toThrow(UserNotFoundError);
  });

  it("refuses to create a second credential for the same user", async () => {
    // Arrange
    const created = await createUser();
    await credentials.createForUser(created.id, "first-hash");

    // Act + Assert
    await expect(credentials.createForUser(created.id, "other-hash")).rejects.toThrow("credential already exists");
    expect(await credentials.getPasswordHash(created.id)).toBe("first-hash");
  });

  it("returns null for a user that does not exist", async () => {
    // Act + Assert
    expect(await credentials.getPasswordHash(MISSING_USER_ID)).toBeNull();
  });
});
