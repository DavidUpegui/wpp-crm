import "server-only";

import { and, eq, type SQL } from "drizzle-orm";

import type { CredentialRepository } from "@/modules/users/domain/credential-repository";
import { UserNotFoundError } from "@/modules/users/domain/errors";
import type { DatabaseExecutor } from "@/shared/db/database";
import { account as accountTable } from "@/shared/db/schema";

// Better Auth's email+password sign-in looks for the `account` row with
// `provider_id = 'credential'` AND `account_id = user id` (see its sign-up route, which
// creates it that way). Storing the hash the same way keeps Better Auth able to verify it.
const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * `CredentialRepository` backed by the Better Auth `account` table: each user's password
 * hash lives in their single "credential" account row. It only stores hashes; hashing
 * happens before, with Better Auth's own hasher (`PasswordHasher`).
 */
export class DrizzleCredentialRepository implements CredentialRepository {
  private readonly database: DatabaseExecutor;

  constructor(database: DatabaseExecutor) {
    this.database = database;
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const rows = await this.database
      .select({ password: accountTable.password })
      .from(accountTable)
      .where(isCredentialOf(userId));
    return rows[0]?.password ?? null;
  }

  /**
   * Creates the credential row of a new user. Call it once per user: a second call
   * throws instead of silently adding a second credential row.
   */
  async createForUser(userId: string, passwordHash: string): Promise<void> {
    if (await this.hasCredential(userId)) {
      throw new Error("A credential already exists for this user.");
    }

    const now = new Date();
    await this.database.insert(accountTable).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: CREDENTIAL_PROVIDER_ID,
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Replaces the stored hash; throws `UserNotFoundError` when the user has no credential row. */
  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const rows = await this.database
      .update(accountTable)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(isCredentialOf(userId))
      .returning({ id: accountTable.id });

    if (rows.length === 0) {
      throw new UserNotFoundError();
    }
  }

  private async hasCredential(userId: string): Promise<boolean> {
    const rows = await this.database
      .select({ id: accountTable.id })
      .from(accountTable)
      .where(isCredentialOf(userId));
    return rows.length > 0;
  }
}

/** The condition that selects a user's credential row, exactly as Better Auth looks it up. */
function isCredentialOf(userId: string): SQL | undefined {
  return and(
    eq(accountTable.userId, userId),
    eq(accountTable.providerId, CREDENTIAL_PROVIDER_ID),
    eq(accountTable.accountId, userId),
  );
}
