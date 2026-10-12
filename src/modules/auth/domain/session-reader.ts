/** A valid, unexpired login session: who is logged in and which session it is. */
export type ActiveSession = {
  userId: string;
  sessionId: string;
};

/**
 * Finds the login session of the current request (FR-006).
 *
 * `Headers` is the web-standard global type, not a Next.js import.
 */
export interface SessionReader {
  /**
   * Returns the session of the request, or `null` when there is no valid,
   * unexpired session. Never throws for a missing or expired session.
   *
   * Always reads fresh from the database (no caching), so a revoked session
   * stops working on the very next request (BR-006, BR-007).
   */
  getCurrentSession(requestHeaders: Headers): Promise<ActiveSession | null>;
}
