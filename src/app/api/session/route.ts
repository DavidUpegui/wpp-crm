/**
 * `/api/session` — log in, read the current user, log out (FR-001–FR-005, FR-008).
 *
 * `POST /api/session` (public, rate-limited, same-origin)
 *   Body: `{ "email": string, "password": string }`
 *   200: `{ "user": { "id" }, "mustChangePassword": boolean }` + session cookie (`Set-Cookie`).
 *        When `mustChangePassword` is true the client must send the user to change it (AC-1.4).
 *   401 `INVALID_CREDENTIALS` (unknown email or wrong password, AC-1.2)
 *   403 `ACCOUNT_DISABLED` (AC-1.3) · 403 `FORBIDDEN` (cross-site request)
 *   422 `VALIDATION_ERROR` (body is not JSON or misses a field)
 *   429 `TOO_MANY_LOGIN_ATTEMPTS` (AC-1.5)
 *
 * `GET /api/session` (session)
 *   200: `{ "user": { "id", "name", "email", "role", "mustChangePassword" } }`
 *   401 `UNAUTHENTICATED` (no valid session, AC-3.4)
 *
 * `DELETE /api/session` (same-origin)
 *   204: the session is ended and its cookie cleared (AC-2.1). Safe to call without a session.
 *   403 `FORBIDDEN` (cross-site request)
 *
 * Errors always have the shape `{ "error": { "code", "message", ... } }`.
 */
import { connection } from "next/server";
import { z } from "zod";

import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { UnauthenticatedError } from "@/modules/auth/domain/errors";
import type { LogInResult } from "@/modules/auth/application/log-in";
import { getCurrentUser, logIn, logOut } from "@/server/container";
import { env } from "@/shared/config/env";
import { assertSameOrigin } from "@/shared/http/assert-same-origin";
import { getClientIp } from "@/shared/http/get-client-ip";
import { toErrorResponse } from "@/shared/http/json-error-response";
import { parseJsonBody } from "@/shared/http/parse-json-body";

const NO_CONTENT_STATUS = 204;

// Only checks that both fields are present. The email FORMAT is deliberately
// not validated here: a malformed email must get the same generic
// INVALID_CREDENTIALS answer as a wrong password (from the use case), not a
// different VALIDATION_ERROR that tells the client something about it (BR-003).
const logInBodySchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

/** Logs in with email and password; Better Auth sets the session cookie (via `nextCookies()`). */
export async function POST(request: Request): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    const { email, password } = await parseJsonBody(request, logInBodySchema);

    const result = await logIn({
      email,
      password,
      ipAddress: getClientIp(request.headers),
      requestHeaders: request.headers,
    });
    return Response.json(toLogInBody(result));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Returns the logged-in, active user of this request. */
export async function GET(request: Request): Promise<Response> {
  await connection();

  try {
    const currentUser = await getCurrentUser(request.headers);
    if (!currentUser) {
      throw new UnauthenticatedError();
    }
    return Response.json(toCurrentUserBody(currentUser));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Ends the current session; Better Auth clears the session cookie (via `nextCookies()`). */
export async function DELETE(request: Request): Promise<Response> {
  await connection();

  try {
    assertSameOrigin(request, env.BETTER_AUTH_URL);
    await logOut(request.headers);
    return new Response(null, { status: NO_CONTENT_STATUS });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toLogInBody(result: LogInResult): { user: { id: string }; mustChangePassword: boolean } {
  return { user: { id: result.userId }, mustChangePassword: result.mustChangePassword };
}

/** Public fields only: the session id never leaves the server. */
function toCurrentUserBody(currentUser: CurrentUser): { user: Omit<CurrentUser, "sessionId"> } {
  return {
    user: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      mustChangePassword: currentUser.mustChangePassword,
    },
  };
}
