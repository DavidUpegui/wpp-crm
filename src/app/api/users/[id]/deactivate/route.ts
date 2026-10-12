/**
 * `/api/users/:id/deactivate` — admins block a user's access (FR-007, FR-008, FR-016).
 *
 * `POST /api/users/:id/deactivate` (admin, same-origin, no body)
 *   204: the user is inactive and all their sessions have ended (AC-9.1).
 *   401 `UNAUTHENTICATED` · 403 `FORBIDDEN` (not an admin or cross-site request)
 *   403 `PASSWORD_CHANGE_REQUIRED`
 *   404 `USER_NOT_FOUND`
 *   409 `CANNOT_MODIFY_OWN_ACCOUNT` (deactivating yourself, AC-9.3)
 *   409 `LAST_ACTIVE_ADMIN` (AC-9.4)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";

import { deactivateUser, requireCurrentUser } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { toErrorResponse } from "@/shared/http/json-error-response";

import { parseUserIdParams, type UserIdRouteContext } from "../user-id-params";

const NO_CONTENT_STATUS = 204;

/** Deactivates a user and ends all their sessions. */
export async function POST(request: Request, context: UserIdRouteContext): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    const actor = await requireCurrentUser(request.headers, { role: "admin" });
    const userId = await parseUserIdParams(context);

    await deactivateUser({ actor, userId });
    return new Response(null, { status: NO_CONTENT_STATUS });
  } catch (error) {
    return toErrorResponse(error);
  }
}
