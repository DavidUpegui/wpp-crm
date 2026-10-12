import type { User } from "./user";

/**
 * The logged-in user performing an admin action (for example creating or
 * editing another user). Only the id and role are needed: the role for the
 * admin permission check (BR-012) and the id for "not on your own account"
 * rules (BR-009).
 */
export type Actor = Pick<User, "id" | "role">;
