import type { User, UserListFilters, UserRole, UserStatus } from "./user";

/**
 * The data needed to create a user. The new user's status is always
 * "active"; there is no way to create an inactive user.
 */
export type NewUser = {
  name: string;
  /** Must already be normalized with `normalizeEmail` (BR-001). */
  email: string;
  role: UserRole;
  /** True when the user starts with a temporary password (BR-011). */
  mustChangePassword: boolean;
};

/**
 * Reads and saves users. Use cases depend on this interface so they never
 * know which database is behind it (and tests can pass an in-memory fake).
 */
export interface UserRepository {
  /** Returns the user with this id, or `null` when there is none. */
  findById(userId: string): Promise<User | null>;

  /** Returns the user with this already-normalized email, or `null` when there is none. */
  findByEmail(normalizedEmail: string): Promise<User | null>;

  /**
   * Returns the users matching all given filters, ordered by name (AC-6.2, AC-6.3).
   * The status filter matches the DISPLAYED status label (see `UserListStatusFilter`):
   * an inactive user is only listed under "inactive", even with a pending password change.
   */
  list(filters: UserListFilters): Promise<User[]>;

  /** Saves a new active user and returns it; throws `EmailAlreadyInUseError` if the email is taken (BR-001). */
  create(newUser: NewUser): Promise<User>;

  /** Changes a user's name and role and returns the updated user; throws `UserNotFoundError`. */
  updateNameAndRole(userId: string, changes: { name: string; role: UserRole }): Promise<User>;

  /** Changes only a user's name and returns the updated user; throws `UserNotFoundError`. */
  updateName(userId: string, name: string): Promise<User>;

  /** Activates or deactivates a user; throws `UserNotFoundError`. */
  setStatus(userId: string, status: UserStatus): Promise<void>;

  /** Marks whether the user must replace their password at next login (BR-011). */
  setMustChangePassword(userId: string, mustChangePassword: boolean): Promise<void>;

  /** Stores when the user last logged in (shown in the users table). */
  recordLogin(userId: string, loggedInAt: Date): Promise<void>;

  /** Counts admins of ANY status, so first-admin setup can tell whether "no admin exists" (BR-014). */
  countAdmins(): Promise<number>;
}
