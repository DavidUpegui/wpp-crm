import "server-only";

import type {
  UserTransactionRepositories,
  UserTransactionRunner,
} from "@/modules/users/domain/user-transaction-runner";
import type { Database } from "@/shared/db/database";

import { DrizzleCredentialRepository } from "./drizzle-credential-repository";
import { DrizzleLockingUserRepository } from "./drizzle-locking-user-repository";

/**
 * `UserTransactionRunner` backed by a Drizzle (Postgres) transaction. The work gets
 * repositories bound to that transaction, so its writes (for example a user and their
 * credential) and its admin lock (BR-008) all live and die together.
 */
export class DrizzleUserTransactionRunner implements UserTransactionRunner {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async run<T>(work: (repositories: UserTransactionRepositories) => Promise<T>): Promise<T> {
    // Drizzle commits when the callback resolves. When it throws, Drizzle rolls the
    // transaction back and rethrows the same error, so callers still get our typed
    // errors (for example `LastActiveAdminError`) and nothing is left half-written.
    return this.database.transaction(async (transaction) =>
      work({
        users: new DrizzleLockingUserRepository(transaction),
        credentials: new DrizzleCredentialRepository(transaction),
      }),
    );
  }
}
