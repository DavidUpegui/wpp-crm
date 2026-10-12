// TEST-ONLY fake. Never import this file from production code.

import type { ActiveSession, SessionReader } from "@/modules/auth/domain/session-reader";

/**
 * A `SessionReader` whose answer is controlled by the test: call
 * `setCurrentSession` to simulate a logged-in request, or pass `null` to
 * simulate a missing or expired session. Starts with no session.
 */
export class FakeSessionReader implements SessionReader {
  private currentSession: ActiveSession | null = null;

  /** Test helper: sets the session every following request will have. */
  setCurrentSession(session: ActiveSession | null): void {
    this.currentSession = session ? { ...session } : null;
  }

  async getCurrentSession(): Promise<ActiveSession | null> {
    return this.currentSession ? { ...this.currentSession } : null;
  }
}
