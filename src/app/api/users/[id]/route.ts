/**
 * `/api/users/:id` — admins change another user's name and role (FR-007, FR-008, FR-015).
 *
 * `PATCH /api/users/:id` (admin, same-origin)
 *   Body: `{ "name": string, "role": "admin" | "agent" }` — no other fields allowed.
 *   200: `{ "user": { "id", "name", "email", "role", "status", "mustChangePassword",
 *         "lastLoginAt", "createdAt" } }` as saved (AC-8.1).
 *   401 `UNAUTHENTICATED` · 403 `FORBIDDEN` (not an admin or cross-site request)
 *   403 `PASSWORD_CHANGE_REQUIRED`
 *   404 `USER_NOT_FOUND`
 *   409 `CANNOT_MODIFY_OWN_ACCOUNT` (changing your own role, AC-8.3)
 *   409 `LAST_ACTIVE_ADMIN` (demoting the last active admin, AC-8.4)
 *   422 `VALIDATION_ERROR` (empty name, unknown role, or an extra field such as `email`)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import { USER_ROLES } from "@/modules/users/domain/user";
import { requireCurrentUser, updateUser } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseJsonBody } from "@/shared/http/parse-json-body";

import { toUserJson } from "../user-json";
import { parseUserIdParams, type UserIdRouteContext } from "./user-id-params";

// `.strict()` rejects unknown fields instead of silently ignoring them: a
// user's email can never be changed after creation (BR-010), so a client
// sending `email` gets a clear VALIDATION_ERROR rather than a fake success.
const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(1),
    role: z.enum(USER_ROLES),
  })
  .strict();

/** Changes a user's name and role and returns the user as saved. */
export async function PATCH(request: Request, context: UserIdRouteContext): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    const actor = await requireCurrentUser(request.headers, { role: "admin" });
    const userId = await parseUserIdParams(context);
    const { name, role } = await parseJsonBody(request, updateUserBodySchema);

    const user = await updateUser({ actor, userId, name, role });
    return Response.json({ user: toUserJson(user) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
