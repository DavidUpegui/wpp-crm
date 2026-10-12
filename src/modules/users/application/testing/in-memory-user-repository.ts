// TEST-ONLY fakes. Never import this file from production code.
//
// This file holds two classes (an exception to "one class per file") because
// task T010 pairs the fake repository with the fake transaction runner that
// wraps it.

import { EmailAlreadyInUseError, UserNotFoundError } from "@/modules/users/domain/errors";
import { normalizeEmail } from "@/modules/users/domain/normalize-email";
import type {
  User,
  UserListFilters,
  UserListStatusFilter,
  UserRole,
  UserStatus,
} from "@/modules/users/domain/user";
import type { NewUser } from "@/modules/users/domain/user-repository";
import type {
  LockingUserRepository,
  UserTransactionRepositories,
  UserTransactionRunner,
} from "@/modules/users/domain/user-transaction-runner";

import type { InMemoryCredentialRepository } from "./in-memory-credential-repository";

const USER_ID_PREFIX = "user-";

/**
 * A `LockingUserRepository` that keeps users in memory, for use case tests.
 * It throws the same domain errors as the real repository (duplicate email →
 * `EmailAlreadyInUseError`, unknown id → `UserNotFoundError`) and always
 * returns copies, so a test cannot change stored users by accident.
 */
export class InMemoryUserRepository implements LockingUserRepository {
  private usersById = new Map<string, User>();
  private nextIdNumber = 1;
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async findById(userId: string): Promise<User | null> {
    const user = this.usersById.get(userId);
    return user ? copyUser(user) : null;
  }

  async findByEmail(normalizedEmail: string): Promise<User | null> {
    const user = this.findStoredByEmail(normalizedEmail);
    return user ? copyUser(user) : null;
  }

  async list(filters: UserListFilters): Promise<User[]> {
    const matchingUsers: User[] = [];
    for (const user of this.usersById.values()) {
      if (matchesFilters(user, filters)) {
        matchingUsers.push(copyUser(user));
      }
    }
    return matchingUsers.sort((first, second) => first.name.localeCompare(second.name));
  }

  async create(newUser: NewUser): Promise<User> {
    this.assertEmailIsFree(newUser.email, null);

    const createdAt = this.now();
    const user: User = {
      id: this.generateId(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: "active",
      mustChangePassword: newUser.mustChangePassword,
      lastLoginAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    this.usersById.set(user.id, user);
    return copyUser(user);
  }

  async updateNameAndRole(userId: string, changes: { name: string; role: UserRole }): Promise<User> {
    return this.updateStored(userId, { name: changes.name, role: changes.role });
  }

  async updateName(userId: string, name: string): Promise<User> {
    return this.updateStored(userId, { name });
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    this.updateStored(userId, { status });
  }

  async setMustChangePassword(userId: string, mustChangePassword: boolean): Promise<void> {
    this.updateStored(userId, { mustChangePassword });
  }

  async recordLogin(userId: string, loggedInAt: Date): Promise<void> {
    this.updateStored(userId, { lastLoginAt: new Date(loggedInAt) });
  }

  async countAdmins(): Promise<number> {
    let adminCount = 0;
    for (const user of this.usersById.values()) {
      if (user.role === "admin") {
        adminCount += 1;
      }
    }
    return adminCount;
  }

  /**
   * Returns the number of ACTIVE admins. Nothing is really locked: tests run
   * one use case at a time in a single thread, so there is no concurrent
   * transaction to block. The real locking is covered by integration tests.
   */
  async lockActiveAdmins(): Promise<number> {
    let activeAdminCount = 0;
    for (const user of this.usersById.values()) {
      if (user.role === "admin" && user.status === "active") {
        activeAdminCount += 1;
      }
    }
    return activeAdminCount;
  }

  /**
   * Test helper: stores a fully specified user (see `buildUser`). Throws
   * `EmailAlreadyInUseError` when another user already has the email, just
   * like the database's unique index would.
   */
  seed(user: User): void {
    this.assertEmailIsFree(user.email, user.id);
    this.usersById.set(user.id, copyUser(user));
  }

  /**
   * Copies all stored users. Exists only so `InMemoryUserTransactionRunner`
   * can roll back when the work of a fake transaction throws.
   */
  snapshot(): Map<string, User> {
    return copyUsersById(this.usersById);
  }

  /** Puts back a copy taken with `snapshot()` (fake transaction rollback only). */
  restore(snapshot: Map<string, User>): void {
    this.usersById = copyUsersById(snapshot);
  }

  private findStoredByEmail(email: string): User | undefined {
    const wantedEmail = normalizeEmail(email);
    for (const user of this.usersById.values()) {
      if (normalizeEmail(user.email) === wantedEmail) {
        return user;
      }
    }
    return undefined;
  }

  /** Mirrors the database's case-insensitive unique index on email (BR-001). */
  private assertEmailIsFree(email: string, ownUserId: string | null): void {
    const existingUser = this.findStoredByEmail(email);
    if (existingUser && existingUser.id !== ownUserId) {
      throw new EmailAlreadyInUseError();
    }
  }

  private updateStored(userId: string, changes: Partial<User>): User {
    const storedUser = this.usersById.get(userId);
    if (!storedUser) {
      throw new UserNotFoundError();
    }

    const updatedUser: User = { ...storedUser, ...changes, updatedAt: this.now() };
    this.usersById.set(userId, updatedUser);
    return copyUser(updatedUser);
  }

  /** Readable, predictable ids (`user-1`, `user-2`, …) that skip seeded ids. */
  private generateId(): string {
    let candidateId = USER_ID_PREFIX + this.nextIdNumber;
    while (this.usersById.has(candidateId)) {
      this.nextIdNumber += 1;
      candidateId = USER_ID_PREFIX + this.nextIdNumber;
    }
    this.nextIdNumber += 1;
    return candidateId;
  }
}

/**
 * A `UserTransactionRunner` for tests. It honors the "rolls back on error"
 * contract by snapshotting both in-memory stores before `work` and putting
 * them back if `work` throws (the error is then rethrown).
 */
export class InMemoryUserTransactionRunner implements UserTransactionRunner {
  private readonly users: InMemoryUserRepository;
  private readonly credentials: InMemoryCredentialRepository;

  constructor(users: InMemoryUserRepository, credentials: InMemoryCredentialRepository) {
    this.users = users;
    this.credentials = credentials;
  }

  async run<T>(work: (repositories: UserTransactionRepositories) => Promise<T>): Promise<T> {
    const usersBefore = this.users.snapshot();
    const credentialsBefore = this.credentials.snapshot();

    try {
      return await work({ users: this.users, credentials: this.credentials });
    } catch (error) {
      this.users.restore(usersBefore);
      this.credentials.restore(credentialsBefore);
      throw error;
    }
  }
}

function matchesFilters(user: User, filters: UserListFilters): boolean {
  if (filters.role && user.role !== filters.role) {
    return false;
  }
  if (filters.status && !matchesStatusFilter(user, filters.status)) {
    return false;
  }
  if (filters.search && !matchesSearch(user, filters.search)) {
    return false;
  }
  return true;
}

/**
 * Each status filter matches exactly the users whose DISPLAYED status label is that
 * status (AC-6.1, AC-6.3). Same precedence as the table's label: "inactive" wins over a
 * pending password change, so "active" and "must_change_password" only match active users.
 */
function matchesStatusFilter(user: User, statusFilter: UserListStatusFilter): boolean {
  if (statusFilter === "inactive") {
    return user.status === "inactive";
  }
  return isActiveWithPendingChange(user, statusFilter === "must_change_password");
}

/** True when the user is active and their pending-password-change flag equals `hasPendingPasswordChange`. */
function isActiveWithPendingChange(user: User, hasPendingPasswordChange: boolean): boolean {
  return user.status === "active" && user.mustChangePassword === hasPendingPasswordChange;
}

/** Case-insensitive match on name OR email (AC-6.2). */
function matchesSearch(user: User, search: string): boolean {
  const wantedText = search.toLowerCase();
  return user.name.toLowerCase().includes(wantedText) || user.email.toLowerCase().includes(wantedText);
}

function copyUser(user: User): User {
  return {
    ...user,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

function copyUsersById(usersById: Map<string, User>): Map<string, User> {
  const copy = new Map<string, User>();
  for (const [userId, user] of usersById) {
    copy.set(userId, copyUser(user));
  }
  return copy;
}
