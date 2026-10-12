/**
 * Reads and saves each user's password hash. It stores only hashes, never
 * plain passwords — hash them first with `PasswordHasher`.
 */
export interface CredentialRepository {
  /** Returns the user's stored password hash, or `null` when the user has no password. */
  getPasswordHash(userId: string): Promise<string | null>;

  /** Saves the first password hash of a newly created user. */
  createForUser(userId: string, passwordHash: string): Promise<void>;

  /** Replaces the user's stored password hash (password change or reset). */
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
}
