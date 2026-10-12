import type { SessionRevoker } from "@/modules/users/domain/session-revoker";

import type { Auth } from "./create-better-auth";

/**
 * `SessionRevoker` backed by Better Auth's internal adapter, which deletes the
 * session rows. Sessions are never cached (cookie cache off), so a revoked
 * session is logged out on its very next request (BR-006, BR-013).
 */
export class BetterAuthSessionRevoker implements SessionRevoker {
  constructor(private readonly auth: Auth) {}

  async revokeAllForUser(userId: string): Promise<void> {
    const context = await this.auth.$context;
    await context.internalAdapter.deleteUserSessions(userId);
  }

  async revokeAllForUserExcept(userId: string, keepSessionId: string): Promise<void> {
    const context = await this.auth.$context;

    // `listSessions` returns at most 100 rows (Better Auth's default `findMany`
    // limit), so we repeat until only the kept session is left. Every round
    // deletes at least one session, so the loop always ends.
    while (true) {
      const sessions = await context.internalAdapter.listSessions(userId);

      // Better Auth deletes sessions by token, not by id.
      const tokensToRevoke = sessions
        .filter((session) => session.id !== keepSessionId)
        .map((session) => session.token);

      if (tokensToRevoke.length === 0) {
        return;
      }
      await context.internalAdapter.deleteSessions(tokensToRevoke);
    }
  }
}
