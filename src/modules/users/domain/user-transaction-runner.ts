import type { CredentialRepository } from "./credential-repository";
import type { UserRepository } from "./user-repository";

/**
 * A `UserRepository` that works inside a transaction and can lock the
 * active admins, so the "last active admin" rule (BR-008) stays true even
 * when two admins act at the same time.
 */
export interface LockingUserRepository extends UserRepository {
  /**
   * Locks the rows of all active admins until the transaction ends and
   * returns how many there are. Must be called before checking the BR-008
   * rules (`assertAdminCanChangeRole`, `assertAdminCanDeactivate`).
   */
  lockActiveAdmins(): Promise<number>;
}

// Plan §3 only passed `users` to the work function; `credentials` is added so
// creating a user and their password hash is also atomic.
/** The repositories available inside one transaction. */
export type UserTransactionRepositories = {
  users: LockingUserRepository;
  credentials: CredentialRepository;
};

/**
 * Runs work inside one database transaction: everything inside `work`
 * commits together or rolls back together (for example the user and
 * credential rows on creation, or lock + check + update for last-admin
 * protection).
 */
export interface UserTransactionRunner {
  /** Runs `work` in a transaction and returns its result; any error thrown rolls everything back and is rethrown. */
  run<T>(work: (repositories: UserTransactionRepositories) => Promise<T>): Promise<T>;
}
