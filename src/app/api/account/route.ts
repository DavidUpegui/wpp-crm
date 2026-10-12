/**
 * `/api/account` — the logged-in user changes their own display name (FR-008, FR-011).
 *
 * `PATCH /api/account` (session, same-origin)
 *   Body: `{ "name": string }`
 *   200: `{ "user": { "id", "name" } }` with the saved (trimmed) name (AC-5.1).
 *   401 `UNAUTHENTICATED` (no valid session)
 *   403 `PASSWORD_CHANGE_REQUIRED` (the user still has a temporary password, BR-011)
 *   403 `FORBIDDEN` (cross-site request)
 *   422 `NAME_REQUIRED` (the name is empty or only spaces)
 *   422 `VALIDATION_ERROR` (body is not JSON or `name` is not a string)
 *
 * Email and role cannot be changed here (AC-5.4); any other field is ignored.
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { UnauthenticatedError } from "@/modules/auth/domain/errors";
import { getCurrentUser, requireCurrentUser, updateOwnName } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseJsonBody } from "@/shared/http/parse-json-body";

// Only checks the type. Trimming and the "not empty" rule belong to the use
// case, so the API answers NAME_REQUIRED exactly like the "Mi cuenta" form.
const updateNameBodySchema = z.object({
  name: z.string(),
});

/** Changes the current user's own name and returns the name as saved. */
export async function PATCH(request: Request): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    const currentUser = await requireCurrentUser(request.headers);
    const { name } = await parseJsonBody(request, updateNameBodySchema);

    await updateOwnName({ currentUser, name });

    // Re-read the user so the answer shows the name exactly as stored.
    const updatedUser = await getCurrentUser(request.headers);
    if (!updatedUser) {
      throw new UnauthenticatedError();
    }
    return Response.json(toAccountBody(updatedUser));
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toAccountBody(user: CurrentUser): { user: { id: string; name: string } } {
  return { user: { id: user.id, name: user.name } };
}
