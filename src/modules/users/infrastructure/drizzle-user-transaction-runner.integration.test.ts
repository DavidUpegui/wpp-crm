// Integration tests for `DrizzleUserTransactionRunner`, against the real Postgres test
// database (`pnpm test:integration`): atomic commit/rollback, and the last-admin rule
// (BR-008) holding when two admins act at the same time (spec §12).

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { makeDeactivateUser } from "@/modules/users/application/deactivate-user";
import { SpySessionRevoker } from "@/modules/users/application/testing/spy-session-revoker";
import { makeUpdateUser } from "@/modules/users/application/update-user";
import type { Actor } from "@/modules/users/domain/actor";
import { LastActiveAdminError } from "@/modules/users/domain/errors";
import type { User } from "@/modules/users/domain/user";
import type {
  LockingUserRepository,
  UserTransactionRepositories,
  UserTransactionRunner,
} from "@/modules/users/domain/user-transaction-runner";
import { createTestDatabase, resetAuthTables } from "../../../../tests/integration/test-database";

import { DrizzleCredentialRepository } from "./drizzle-credential-repository";
import { DrizzleUserRepository } from "./drizzle-user-repository";
import { DrizzleUserTransactionRunner } from "./drizzle-user-transaction-runner";

// How long each transaction keeps the admin lock before continuing. Long enough for the
// other request to open its own transaction and reach `lockActiveAdmins` meanwhile.
const LOCK_HOLD_MS = 200;
const WORK_FAILURE_MESSAGE = "work failed on purpose";

// The pool (default: up to 10 connections) lets both transactions run at the same time.
const testDatabase = createTestDatabase();
const users = new DrizzleUserRepository(testDatabase.database);
const credentials = new DrizzleCredentialRepository(testDatabase.database);
const runner = new DrizzleUserTransactionRunner(testDatabase.database);

beforeEach(async () => {
  await resetAuthTables(testDatabase.database);
});

afterAll(async () => {
  await testDatabase.close();
});

/**
 * Wraps the REAL runner so every transaction waits a moment right after locking the
 * admins. Without it, the first transaction might commit before the second one even
 * starts, and the test would pass without ever exercising the race. With it, the two
 * transactions are guaranteed to overlap: the second one reaches `lockActiveAdmins`
 * while the first still holds the lock. (If the lock were missing, both would read
 * "2 active admins" and both changes would succeed, so the test would fail.)
 */
class SlowLockTransactionRunner implements UserTransactionRunner {
  constructor(private readonly realRunner: UserTransactionRunner) {}

  run<T>(work: (repositories: UserTransactionRepositories) => Promise<T>): Promise<T> {
    return this.realRunner.run((repositories) =>
      work({ ...repositories, users: holdLockLonger(repositories.users) }),
    );
  }
}

function holdLockLonger(lockingUsers: LockingUserRepository): LockingUserRepository {
  const lockActiveAdmins = lockingUsers.lockActiveAdmins.bind(lockingUsers);
  lockingUsers.lockActiveAdmins = async (): Promise<number> => {
    const activeAdminCount = await lockActiveAdmins();
    await new Promise((resolve) => setTimeout(resolve, LOCK_HOLD_MS));
    return activeAdminCount;
  };
  return lockingUsers;
}

async function createAdmins(): Promise<{ ana: User; bruno: User }> {
  const ana = await users.create({ name: "Ana", email: "ana@example.com", role: "admin", mustChangePassword: false });
  const bruno = await users.create({ name: "Bruno", email: "bruno@example.com", role: "admin", mustChangePassword: false });
  return { ana, bruno };
}

function asActor(user: User): Actor {
  return { id: user.id, role: user.role };
}

async function countActiveAdmins(): Promise<number> {
  const activeAdmins = await users.list({ role: "admin", status: "active" });
  return activeAdmins.length;
}

/** Asserts that exactly one of two parallel changes succeeded and the other hit BR-008. */
function expectOneSuccessAndOneLastAdminError(results: PromiseSettledResult<unknown>[]): void {
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toBeInstanceOf(LastActiveAdminError);
}

describe("DrizzleUserTransactionRunner", () => {
  it("keeps one active admin when the only two admins deactivate each other at the same time", async () => {
    // Arrange
    const { ana, bruno } = await createAdmins();
    const sessionRevoker = new SpySessionRevoker();
    const deactivateUser = makeDeactivateUser({
      transactionRunner: new SlowLockTransactionRunner(runner),
      sessionRevoker,
    });

    // Act
    const results = await Promise.allSettled([
      deactivateUser({ actor: asActor(ana), userId: bruno.id }),
      deactivateUser({ actor: asActor(bruno), userId: ana.id }),
    ]);

    // Assert
    expectOneSuccessAndOneLastAdminError(results);
    expect(await countActiveAdmins()).toBe(1);
    // Only the deactivation that committed logged its target out.
    expect(sessionRevoker.revokedAllForUser).toHaveLength(1);
  });

  it("keeps one active admin when the only two admins demote each other at the same time", async () => {
    // Arrange
    const { ana, bruno } = await createAdmins();
    const updateUser = makeUpdateUser({ transactionRunner: new SlowLockTransactionRunner(runner) });

    // Act
    const results = await Promise.allSettled([
      updateUser({ actor: asActor(ana), userId: bruno.id, name: "Bruno", role: "agent" }),
      updateUser({ actor: asActor(bruno), userId: ana.id, name: "Ana", role: "agent" }),
    ]);

    // Assert
    expectOneSuccessAndOneLastAdminError(results);
    expect(await countActiveAdmins()).toBe(1);
  });

  it("rolls back everything when the work throws", async () => {
    // Arrange
    let createdUserId = "";

    // Act
    const run = runner.run(async (repositories) => {
      const created = await repositories.users.create({
        name: "Carla",
        email: "carla@example.com",
        role: "agent",
        mustChangePassword: true,
      });
      createdUserId = created.id;
      await repositories.credentials.createForUser(created.id, "hash");
      throw new Error(WORK_FAILURE_MESSAGE);
    });

    // Assert
    await expect(run).rejects.toThrow(WORK_FAILURE_MESSAGE);
    expect(createdUserId).not.toBe("");
    expect(await users.findById(createdUserId)).toBeNull();
    expect(await users.findByEmail("carla@example.com")).toBeNull();
    expect(await credentials.getPasswordHash(createdUserId)).toBeNull();
  });

  it("commits user and credential together", async () => {
    // Act
    const created = await runner.run(async (repositories) => {
      const newUser = await repositories.users.create({
        name: "Carla",
        email: "carla@example.com",
        role: "agent",
        mustChangePassword: true,
      });
      await repositories.credentials.createForUser(newUser.id, "hash");
      return newUser;
    });

    // Assert
    expect(await users.findById(created.id)).toEqual(created);
    expect(await credentials.getPasswordHash(created.id)).toBe("hash");
  });
});
