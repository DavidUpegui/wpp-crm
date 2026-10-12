import type { UserRole } from "@/modules/users/domain/user";

/**
 * The authenticated, ACTIVE user of the current request.
 *
 * It is read fresh from the database on every request (never cached), so a
 * role change or deactivation takes effect immediately (BR-007).
 */
export type CurrentUser = {
  id: string;
  name: string;
  /** Normalized email (BR-001). */
  email: string;
  role: UserRole;
  /** True while the user still has a temporary password (BR-011). */
  mustChangePassword: boolean;
  /** The session of this request; kept when revoking the user's other sessions (BR-013). */
  sessionId: string;
};
