// TEST-ONLY fake. Never import this file from production code.

import type { PasswordHasher } from "@/modules/users/domain/password-hasher";

const HASH_PREFIX = "hashed:";

/**
 * A predictable `PasswordHasher` for tests: the "hash" is the password with
 * a prefix, so tests can assert which password was stored.
 *
 * Deliberately NOT secure — for tests only.
 */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return HASH_PREFIX + password;
  }

  async verify({ password, hash }: { password: string; hash: string }): Promise<boolean> {
    return hash === HASH_PREFIX + password;
  }
}
