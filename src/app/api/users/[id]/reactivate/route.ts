/**
 * `/api/users/:id/reactivate` — admins restore a user's access (FR-007, FR-008, FR-016).
 *
 * `POST /api/users/:id/reactivate` (admin, same-origin, no body)
 *   204: the user is active again and can log in with their existing password (AC-9.2).
 *   401 `UNAUTHENTICATED` · 403 `FORBIDDEN` (not an admin or cross-site request)
 *   403 `PASSWORD_CHANGE_REQUIRED`
 *   404 `USER_NOT_FOUND`
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";

import { reactivateUser, requireCurrentUser } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { toErrorResponse } from "@/shared/http/json-error-response";

import { parseUserIdParams, type UserIdRouteContext } from "../user-id-params";

const NO_CONTENT_STATUS = 204;

/** Reactivates a deactivated user. */
export async function POST(request: Request, context: UserIdRouteContext): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    const actor = await requireCurrentUser(request.headers, { role: "admin" });
    const userId = await parseUserIdParams(context);

    await reactivateUser({ actor, userId });
    return new Response(null, { status: NO_CONTENT_STATUS });
  } catch (error) {
    return toErrorResponse(error);
  }
}
