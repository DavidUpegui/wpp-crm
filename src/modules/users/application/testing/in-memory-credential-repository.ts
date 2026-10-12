// TEST-ONLY fake. Never import this file from production code.

import type { CredentialRepository } from "@/modules/users/domain/credential-repository";
import { UserNotFoundError } from "@/modules/users/domain/errors";

/**
 * Keeps password hashes in memory (user id → hash) so use case tests run
 * without a database. Mirrors `DrizzleCredentialRepository`: creating a second
 * credential for the same user throws, and replacing the hash of a user without a
 * credential throws `UserNotFoundError`.
 */
export class InMemoryCredentialRepository implements CredentialRepository {
  private passwordHashesByUserId = new Map<string, string>();

  async getPasswordHash(userId: string): Promise<string | null> {
    return this.passwordHashesByUserId.get(userId) ?? null;
  }

  async createForUser(userId: string, passwordHash: string): Promise<void> {
    if (this.passwordHashesByUserId.has(userId)) {
      throw new Error("A credential already exists for this user.");
    }
    this.passwordHashesByUserId.set(userId, passwordHash);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    if (!this.passwordHashesByUserId.has(userId)) {
      throw new UserNotFoundError();
    }
    this.passwordHashesByUserId.set(userId, passwordHash);
  }

  /**
   * Copies the stored hashes. Exists only so `InMemoryUserTransactionRunner`
   * can roll back when the work of a fake transaction throws.
   */
  snapshot(): Map<string, string> {
    return new Map(this.passwordHashesByUserId);
  }

  /** Puts back a copy taken with `snapshot()` (fake transaction rollback only). */
  restore(snapshot: Map<string, string>): void {
    this.passwordHashesByUserId = new Map(snapshot);
  }
}
