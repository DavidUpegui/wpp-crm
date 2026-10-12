import type { User, UserRole, UserStatus } from "@/modules/users/domain/user";

/** How a user looks in every `/api/users` response. Never contains password data. */
export type UserJson = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  /** ISO 8601 date, or `null` when the user has never logged in. */
  lastLoginAt: string | null;
  /** ISO 8601 date. */
  createdAt: string;
};

/**
 * Turns a domain `User` into its public JSON shape.
 *
 * Why one function: every user route answers with the same fields, and
 * listing them explicitly guarantees nothing internal (like `updatedAt` or
 * a future password field) leaks by accident.
 */
export function toUserJson(user: User): UserJson {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
