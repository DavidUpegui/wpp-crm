/**
 * `/api/users` — admins list and create users (FR-007, FR-008, FR-013, FR-014).
 *
 * `GET /api/users?search=&role=&status=` (admin)
 *   All query parameters are optional and combine; an empty value means "no filter".
 *   `search`: text matched against name or email, ignoring case (AC-6.2).
 *   `role`: `admin` | `agent`. `status`: `active` | `inactive` | `must_change_password` (AC-6.3).
 *   200: `{ "users": [ { "id", "name", "email", "role", "status", "mustChangePassword",
 *         "lastLoginAt" (ISO date or null), "createdAt" } ] }`, ordered by name.
 *   401 `UNAUTHENTICATED` · 403 `FORBIDDEN` (not an admin, AC-3.5)
 *   403 `PASSWORD_CHANGE_REQUIRED` (temporary password, BR-011)
 *   422 `VALIDATION_ERROR` (unknown role or status)
 *
 * `POST /api/users` (admin, same-origin)
 *   Body: `{ "name": string, "email": string, "role": "admin" | "agent", "temporaryPassword": string }`
 *   201: `{ "user": { ...same fields as above } }`. The user must change the
 *        password at first login (AC-7.5).
 *   401 `UNAUTHENTICATED` · 403 `FORBIDDEN` (not an admin or cross-site request)
 *   403 `PASSWORD_CHANGE_REQUIRED`
 *   409 `EMAIL_ALREADY_IN_USE` (same email ignoring case, AC-7.2)
 *   422 `VALIDATION_ERROR` (missing name, bad email format, unknown role, AC-7.3)
 *   422 `PASSWORD_POLICY` with `reason` (BR-002, AC-7.3)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import type { User } from "@/modules/users/domain/user";
import { USER_ROLES, USER_STATUSES } from "@/modules/users/domain/user";
import { createUser, listUsers, requireCurrentUser } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseJsonBody } from "@/shared/http/parse-json-body";
import { parseSearchParams } from "@/shared/http/parse-search-params";

import { toUserJson, type UserJson } from "./user-json";

const CREATED_STATUS = 201;

/** Every value the status filter accepts: the stored statuses plus the derived "must change password". */
const STATUS_FILTER_VALUES = [...USER_STATUSES, "must_change_password"] as const;

/** An empty query value (`?role=`) means the filter is not used, like a cleared select. */
function emptyAsAbsent<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

const listUsersQuerySchema = z.object({
  search: emptyAsAbsent(z.string()),
  role: emptyAsAbsent(z.enum(USER_ROLES)),
  status: emptyAsAbsent(z.enum(STATUS_FILTER_VALUES)),
});

// The email FORMAT is checked here so a bad email gets a field-specific
// VALIDATION_ERROR (AC-7.3). The password policy belongs to the use case,
// so the API answers PASSWORD_POLICY exactly like the "Crear usuario" form.
const createUserBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  role: z.enum(USER_ROLES),
  temporaryPassword: z.string(),
});

/** Lists users matching the optional search text and role/status filters. */
export async function GET(request: Request): Promise<Response> {
  await connection();

  try {
    const actor = await requireCurrentUser(request.headers, { role: "admin" });
    const filters = parseSearchParams(request.url, listUsersQuerySchema);

    const users = await listUsers({ actor, filters });
    return Response.json(toUsersBody(users));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Creates a user with a temporary password and returns it. */
export async function POST(request: Request): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    const actor = await requireCurrentUser(request.headers, { role: "admin" });
    const { name, email, role, temporaryPassword } = await parseJsonBody(request, createUserBodySchema);

    const user = await createUser({ actor, name, email, role, temporaryPassword });
    return Response.json({ user: toUserJson(user) }, { status: CREATED_STATUS });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toUsersBody(users: User[]): { users: UserJson[] } {
  return { users: users.map(toUserJson) };
}
