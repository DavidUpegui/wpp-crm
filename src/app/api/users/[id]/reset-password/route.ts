/**
 * `/api/users/:id/reset-password` — admins set a new temporary password for
 * another user (FR-007, FR-008, FR-017).
 *
 * `POST /api/users/:id/reset-password` (admin, same-origin)
 *   Body: `{ "temporaryPassword": string }`
 *   204: the password is replaced, all the user's sessions have ended, and
 *        they must change it at next login (AC-10.1).
 *   401 `UNAUTHENTICATED` · 403 `FORBIDDEN` (not an admin or cross-site request)
 *   403 `PASSWORD_CHANGE_REQUIRED`
 *   404 `USER_NOT_FOUND`
 *   409 `CANNOT_MODIFY_OWN_ACCOUNT` (resetting your own password, AC-10.2)
 *   422 `PASSWORD_POLICY` with `reason` (BR-002)
 *   422 `VALIDATION_ERROR` (body is not JSON or the field is not a string)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import { requireCurrentUser, resetUserPassword } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseJsonBody } from "@/shared/http/parse-json-body";

import { parseUserIdParams, type UserIdRouteContext } from "../user-id-params";

const NO_CONTENT_STATUS = 204;

// Only checks the type. The password policy belongs to the use case, so the
// API answers PASSWORD_POLICY exactly like the "Restablecer contraseña" dialog.
const resetPasswordBodySchema = z.object({
  temporaryPassword: z.string(),
});

/** Sets a new temporary password for a user and ends all their sessions. */
export async function POST(request: Request, context: UserIdRouteContext): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    const actor = await requireCurrentUser(request.headers, { role: "admin" });
    const userId = await parseUserIdParams(context);
    const { temporaryPassword } = await parseJsonBody(request, resetPasswordBodySchema);

    await resetUserPassword({ actor, userId, temporaryPassword });
    return new Response(null, { status: NO_CONTENT_STATUS });
  } catch (error) {
    return toErrorResponse(error);
  }
}
