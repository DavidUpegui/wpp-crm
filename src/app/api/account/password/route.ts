/**
 * `/api/account/password` — the logged-in user changes their own password
 * (FR-008, FR-010, FR-011, FR-012).
 *
 * `POST /api/account/password` (session, same-origin; allowed with a temporary password)
 *   Body: `{ "currentPassword"?: string, "newPassword": string }`
 *     `currentPassword` is required in "Mi cuenta" (AC-5.3) and ignored during
 *     the forced change after a temporary password (AC-4.2).
 *   204: the password was changed. This session stays valid; the user's other
 *        sessions are ended (BR-013, AC-5.5).
 *   401 `UNAUTHENTICATED` (no valid session)
 *   403 `FORBIDDEN` (cross-site request)
 *   422 `WRONG_CURRENT_PASSWORD` (missing or wrong current password, AC-5.3)
 *   422 `NEW_PASSWORD_SAME_AS_CURRENT` (AC-4.3)
 *   422 `PASSWORD_POLICY` with `reason` (BR-002)
 *   422 `VALIDATION_ERROR` (body is not JSON or a field has the wrong type)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import { changeOwnPassword, requireCurrentUser } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseJsonBody } from "@/shared/http/parse-json-body";

const NO_CONTENT_STATUS = 204;

// Only checks the types. The password policy and the current-password check
// belong to the use case, so the API answers with the same error codes as the UI.
const changePasswordBodySchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string(),
});

/** Changes the current user's own password; the current session is kept. */
export async function POST(request: Request): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    // A user with a temporary password may do nothing else, so this route
    // MUST stay reachable for them: it is how they finish the forced change
    // (BR-011, AC-4.1, AC-4.2).
    const currentUser = await requireCurrentUser(request.headers, { allowPendingPasswordChange: true });
    const { currentPassword, newPassword } = await parseJsonBody(request, changePasswordBodySchema);

    await changeOwnPassword({ currentUser, currentPassword, newPassword });
    return new Response(null, { status: NO_CONTENT_STATUS });
  } catch (error) {
    return toErrorResponse(error);
  }
}
