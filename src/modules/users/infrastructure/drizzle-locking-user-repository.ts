import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { UserRole } from "@/modules/users/domain/user";
import type { LockingUserRepository } from "@/modules/users/domain/user-transaction-runner";
import type { DatabaseTransaction } from "@/shared/db/database";
import { user as userTable } from "@/shared/db/schema";

import { DrizzleUserRepository } from "./drizzle-user-repository";

const ADMIN_ROLE: UserRole = "admin";

/**
 * `DrizzleUserRepository` plus `lockActiveAdmins`, for use inside a transaction
 * opened by `DrizzleUserTransactionRunner`. It only accepts a transaction (not the
 * database), because a `FOR UPDATE` lock outside a transaction would be released
 * immediately and protect nothing.
 */
export class DrizzleLockingUserRepository extends DrizzleUserRepository implements LockingUserRepository {
  constructor(transaction: DatabaseTransaction) {
    super(transaction);
  }

  /**
   * Locks every active admin row until the transaction ends and returns how many
   * there are (BR-008 under concurrency, spec §12).
   *
   * - `ORDER BY id` makes every transaction lock the rows in the same order, so two
   *   transactions cannot each hold one row while waiting for the other (deadlock).
   * - In Postgres READ COMMITTED, a `FOR UPDATE` that had to wait re-checks the WHERE
   *   on the newest row version once the other transaction commits. So an admin the
   *   other transaction just deactivated or demoted is no longer counted, and the
   *   last-admin check sees the real number.
   */
  async lockActiveAdmins(): Promise<number> {
    const lockedRows = await this.database
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.role, ADMIN_ROLE), eq(userTable.isActive, true)))
      .orderBy(asc(userTable.id))
      .for("update");
    return lockedRows.length;
  }
}
