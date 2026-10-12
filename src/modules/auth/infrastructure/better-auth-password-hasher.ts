import type { PasswordHasher } from "@/modules/users/domain/password-hasher";

import type { Auth } from "./create-better-auth";

/**
 * `PasswordHasher` that uses Better Auth's own hashing (scrypt by default).
 *
 * Why Better Auth's and not another library: the hashes we store when creating
 * users or changing passwords must be the exact format Better Auth checks at sign-in.
 */
export class BetterAuthPasswordHasher implements PasswordHasher {
  constructor(private readonly auth: Auth) {}

  async hash(password: string): Promise<string> {
    const context = await this.auth.$context;
    return context.password.hash(password);
  }

  async verify({ password, hash }: { password: string; hash: string }): Promise<boolean> {
    const context = await this.auth.$context;
    return context.password.verify({ password, hash });
  }
}
