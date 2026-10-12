/**
 * Ends a user's login sessions. The effect is immediate because sessions are
 * never cached: the next request with a revoked session is logged out
 * (BR-006 on deactivation and password reset, BR-013 on own password change).
 */
export interface SessionRevoker {
  /** Ends every session of the user (deactivation, password reset by an admin). */
  revokeAllForUser(userId: string): Promise<void>;

  /** Ends every session of the user except `keepSessionId`, so changing your own password keeps you logged in (BR-013). */
  revokeAllForUserExcept(userId: string, keepSessionId: string): Promise<void>;
}
