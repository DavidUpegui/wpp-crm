import type { ActiveSession, SessionReader } from "@/modules/auth/domain/session-reader";

import type { Auth } from "./create-better-auth";

/**
 * `SessionReader` backed by Better Auth (FR-006). The cookie cache is off
 * (see `create-better-auth.ts`), so every call reads the session from the
 * database and a revoked session is gone on the next request (BR-006).
 */
export class BetterAuthSessionReader implements SessionReader {
  constructor(private readonly auth: Auth) {}

  async getCurrentSession(requestHeaders: Headers): Promise<ActiveSession | null> {
    // Side effect: when the session is older than `updateAge` (1 day), Better Auth
    // pushes its expiry forward here. That is the 30-day sliding session (BR-005).
    const result = await this.auth.api.getSession({ headers: requestHeaders });
    if (!result) {
      return null;
    }
    return { userId: result.session.userId, sessionId: result.session.id };
  }
}
