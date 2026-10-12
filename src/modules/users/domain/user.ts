/**
 * Every role a user can have. Kept as a readonly array so input validation
 * (for example a Zod enum in a server action) can reuse the same list
 * instead of repeating the values.
 */
export const USER_ROLES = ["admin", "agent"] as const;

/** What a user is allowed to do: admins manage users, agents only work conversations. */
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Every stored account status. Kept as a readonly array for the same reason
 * as `USER_ROLES`: one source of truth for validation.
 */
export const USER_STATUSES = ["active", "inactive"] as const;

/**
 * Whether the account can log in. Users are never deleted (spec §8), only
 * switched between "active" and "inactive".
 */
export type UserStatus = (typeof USER_STATUSES)[number];

/** A person who can log in to the CRM (spec §8, "User"). */
export type User = {
  id: string;
  /** Display name shown in the UI. */
  name: string;
  /** Always stored normalized (trimmed, lower case) — see `normalizeEmail` (BR-001). */
  email: string;
  role: UserRole;
  status: UserStatus;
  /** True while the user still has a temporary password and must replace it (BR-011). */
  mustChangePassword: boolean;
  /** `null` when the user has never logged in (shown as "Nunca"). */
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Status values the user list can be filtered by — one per status label the
 * users table shows (AC-6.1). Each value selects exactly the users whose
 * DISPLAYED label is that status (AC-6.3), where "inactive" wins over a
 * pending password change:
 * - `active`: active AND no pending password change ("Activo").
 * - `must_change_password`: active AND pending password change ("Debe cambiar contraseña").
 * - `inactive`: every inactive user, with or without a pending change ("Inactivo").
 *
 * Why a separate type: "Debe cambiar contraseña" is not stored in `status` —
 * it is derived from `mustChangePassword`. One filter covering the three
 * labels keeps the listing UI and the repository query simple.
 */
export type UserListStatusFilter = UserStatus | "must_change_password";

/**
 * Optional filters for listing users (AC-6.2, AC-6.3). All filters combine;
 * a missing filter means "do not filter by this".
 */
export type UserListFilters = {
  /** Case-insensitive text matched against name or email (AC-6.2). */
  search?: string;
  role?: UserRole;
  status?: UserListStatusFilter;
};
