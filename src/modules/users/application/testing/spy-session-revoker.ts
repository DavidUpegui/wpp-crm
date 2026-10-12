// TEST-ONLY spy. Never import this file from production code.

import type { SessionRevoker } from "@/modules/users/domain/session-revoker";

/**
 * Records every revocation request instead of ending real sessions, so tests
 * can assert which sessions a use case asked to revoke (BR-006, BR-013).
 */
export class SpySessionRevoker implements SessionRevoker {
  /** User ids passed to `revokeAllForUser`, in call order. */
  public readonly revokedAllForUser: string[] = [];

  /** Arguments passed to `revokeAllForUserExcept`, in call order. */
  public readonly revokedAllExcept: { userId: string; keepSessionId: string }[] = [];

  async revokeAllForUser(userId: string): Promise<void> {
    this.revokedAllForUser.push(userId);
  }

  async revokeAllForUserExcept(userId: string, keepSessionId: string): Promise<void> {
    this.revokedAllExcept.push({ userId, keepSessionId });
  }
}
