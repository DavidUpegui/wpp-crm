import "server-only";

import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";

import { EmailAlreadyInUseError, UserNotFoundError } from "@/modules/users/domain/errors";
import {
  USER_ROLES,
  type User,
  type UserListFilters,
  type UserListStatusFilter,
  type UserRole,
  type UserStatus,
} from "@/modules/users/domain/user";
import type { NewUser, UserRepository } from "@/modules/users/domain/user-repository";
import type { DatabaseExecutor } from "@/shared/db/database";
import { user as userTable } from "@/shared/db/schema";

// Postgres error code for "unique_violation".
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION_CODE = "23505";
// Both constraints that keep emails unique: the generated one and our lower(email) index (BR-001).
const EMAIL_UNIQUE_CONSTRAINTS = ["user_email_unique", "user_email_lower_unique"];
const ADMIN_ROLE: UserRole = "admin";

type UserRow = typeof userTable.$inferSelect;

/**
 * `UserRepository` backed by the Better Auth `user` table (Drizzle + Postgres).
 * It receives the database (or a transaction) in the constructor so it never
 * imports the global client, and it always returns domain `User`s, never raw rows.
 */
export class DrizzleUserRepository implements UserRepository {
  protected readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async findById(userId: string): Promise<User | null> {
    const rows = await this.database.select().from(userTable).where(eq(userTable.id, userId));
    return rows[0] ? mapRowToUser(rows[0]) : null;
  }

  async findByEmail(normalizedEmail: string): Promise<User | null> {
    const rows = await this.database.select().from(userTable).where(eq(userTable.email, normalizedEmail));
    return rows[0] ? mapRowToUser(rows[0]) : null;
  }

  async list(filters: UserListFilters): Promise<User[]> {
    const rows = await this.database
      .select()
      .from(userTable)
      .where(
        and(
          buildSearchCondition(filters.search),
          buildRoleCondition(filters.role),
          buildStatusCondition(filters.status),
        ),
      )
      .orderBy(asc(userTable.name));
    return rows.map(mapRowToUser);
  }

  async create(newUser: NewUser): Promise<User> {
    try {
      const rows = await this.database
        .insert(userTable)
        .values({
          id: crypto.randomUUID(),
          name: newUser.name,
          email: newUser.email,
          emailVerified: false,
          role: newUser.role,
          isActive: true,
          mustChangePassword: newUser.mustChangePassword,
        })
        .returning();
      return mapRowToUser(rows[0]);
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new EmailAlreadyInUseError();
      }
      throw error;
    }
  }

  async updateNameAndRole(userId: string, changes: { name: string; role: UserRole }): Promise<User> {
    return this.updateRow(userId, { name: changes.name, role: changes.role });
  }

  async updateName(userId: string, name: string): Promise<User> {
    return this.updateRow(userId, { name });
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    await this.updateRow(userId, { isActive: status === "active" });
  }

  async setMustChangePassword(userId: string, mustChangePassword: boolean): Promise<void> {
    await this.updateRow(userId, { mustChangePassword });
  }

  async recordLogin(userId: string, loggedInAt: Date): Promise<void> {
    await this.updateRow(userId, { lastLoginAt: loggedInAt });
  }

  async countAdmins(): Promise<number> {
    const rows = await this.database
      .select({ adminCount: count() })
      .from(userTable)
      .where(eq(userTable.role, ADMIN_ROLE));
    return rows[0]?.adminCount ?? 0;
  }

  /** Updates one user (always refreshing `updatedAt`); throws `UserNotFoundError` when no row matched. */
  private async updateRow(userId: string, changes: Partial<UserRow>): Promise<User> {
    const rows = await this.database
      .update(userTable)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(userTable.id, userId))
      .returning();

    if (!rows[0]) {
      throw new UserNotFoundError();
    }
    return mapRowToUser(rows[0]);
  }
}

/** Matches name OR email, case-insensitively; the search text is matched literally (AC-6.2). */
function buildSearchCondition(search: string | undefined): SQL | undefined {
  if (!search) {
    return undefined;
  }
  const pattern = `%${escapeLikePattern(search)}%`;
  return or(ilike(userTable.name, pattern), ilike(userTable.email, pattern));
}

function buildRoleCondition(role: UserRole | undefined): SQL | undefined {
  if (!role) {
    return undefined;
  }
  return eq(userTable.role, role);
}

/**
 * Each status filter returns exactly the users whose DISPLAYED status label is that
 * status (AC-6.1, AC-6.3). Same precedence as the table's label: "inactive" wins over a
 * pending password change, so "active" and "must_change_password" only include active users.
 */
function buildStatusCondition(status: UserListStatusFilter | undefined): SQL | undefined {
  if (!status) {
    return undefined;
  }
  if (status === "inactive") {
    return eq(userTable.isActive, false);
  }
  return buildActiveCondition(status === "must_change_password");
}

/** Active users whose pending-password-change flag equals `hasPendingPasswordChange`. */
function buildActiveCondition(hasPendingPasswordChange: boolean): SQL | undefined {
  return and(eq(userTable.isActive, true), eq(userTable.mustChangePassword, hasPendingPasswordChange));
}

/**
 * Escapes the LIKE wildcards (`%`, `_`) and the escape character itself (`\`, Postgres'
 * default LIKE escape), so user input such as "50%" is searched as plain text.
 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * True when Postgres rejected the insert because the email is already used. Drizzle wraps
 * driver errors in `DrizzleQueryError`, so the pg error (with `code` and `constraint`)
 * may be the error itself or its `cause`.
 */
function isEmailUniqueViolation(error: unknown): boolean {
  const databaseError = findPostgresError(error);
  if (!databaseError || databaseError.code !== UNIQUE_VIOLATION_CODE) {
    return false;
  }
  return EMAIL_UNIQUE_CONSTRAINTS.includes(databaseError.constraint ?? "");
}

function findPostgresError(error: unknown): { code?: string; constraint?: string } | null {
  if (!(error instanceof Error)) {
    return null;
  }
  if ("code" in error) {
    return error as { code?: string; constraint?: string };
  }
  return findPostgresError(error.cause);
}

function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: parseRole(row.role),
    status: row.isActive ? "active" : "inactive",
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Fails loudly if the database ever holds a role the domain does not know. */
function parseRole(role: string): UserRole {
  const knownRole = USER_ROLES.find((candidate) => candidate === role);
  if (!knownRole) {
    throw new Error(`Unknown user role stored in the database: "${role}"`);
  }
  return knownRole;
}
