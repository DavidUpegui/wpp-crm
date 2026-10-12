/**
 * One-way secure password hashing. Plain passwords are only passed through
 * here; they are never stored or logged.
 */
export interface PasswordHasher {
  /** Returns a secure one-way hash of the password, safe to store. */
  hash(password: string): Promise<string>;

  /** True when `password` matches the stored `hash`. */
  verify(input: { password: string; hash: string }): Promise<boolean>;
}
