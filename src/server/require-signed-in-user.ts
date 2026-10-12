import "server-only";
import { redirect } from "next/navigation";

import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { PasswordChangeRequiredError, UnauthenticatedError } from "@/modules/auth/domain/errors";
import { ForbiddenError } from "@/shared/errors/forbidden-error";

import { requireCurrentUser } from "./container";

const LOGIN_PATH = "/login";
const CHANGE_PASSWORD_PATH = "/change-password";

/** What a page or Server Action passes to `requireSignedInUser`. */
export type RequireSignedInUserInput = {
  /** The request headers (a mutable copy of `headers()`), used to read the session cookie. */
  requestHeaders: Headers;
  /** Where to come back after logging in, e.g. "/users?role=agent" (AC-3.6). Sanitized again by the login page. */
  returnTo: string;
  /** Set to "admin" for admin-only pages and actions (BR-012). */
  role?: "admin";
};

/**
 * The session check every page and Server Action with real data must call
 * FIRST. The `(app)` layout guard is NOT enough: in the App Router pages and
 * actions run independently of layouts (and layouts do not re-run on client
 * navigation), so each one checks the session itself.
 *
 * - Logged out → redirect to login, coming back to `returnTo` afterwards.
 * - Temporary password → redirect to the forced change (BR-011).
 * - Not an admin when `role: "admin"` → `ForbiddenError` is RE-THROWN, so
 *   each page decides how to show it (e.g. `<ForbiddenView />`, AC-3.3).
 *
 * Lives next to the container because it is delivery-layer glue (Next.js
 * `redirect`) on top of the `requireCurrentUser` use case.
 */
export async function requireSignedInUser(input: RequireSignedInUserInput): Promise<CurrentUser> {
  let redirectPath: string;
  try {
    return await requireCurrentUser(input.requestHeaders, { role: input.role });
  } catch (error) {
    redirectPath = toGuardRedirectPath(error, input.returnTo);
  }
  // `redirect()` throws, so it is called outside the try/catch.
  redirect(redirectPath);
}

/** What a page or Server Action passes to `requireSignedInAdminOrNull`. */
export type RequireSignedInAdminOrNullInput = Omit<RequireSignedInUserInput, "role">;

/**
 * Like `requireSignedInUser` with `role: "admin"`, but returns `null` when the
 * user is logged in and is not an admin (BR-012), so admin-only pages can show
 * `<ForbiddenView />` and Server Actions can return a "no permission" state.
 *
 * Logged-out and temporary-password users are still redirected; every other
 * error (including the redirect "errors" thrown by `redirect()`) propagates.
 */
export async function requireSignedInAdminOrNull(input: RequireSignedInAdminOrNullInput): Promise<CurrentUser | null> {
  try {
    return await requireSignedInUser({ ...input, role: "admin" });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return null;
    }
    throw error;
  }
}

/** Where a failed session check sends the user; any other error (ForbiddenError included) is re-thrown. */
function toGuardRedirectPath(error: unknown, returnTo: string): string {
  if (error instanceof UnauthenticatedError) {
    return `${LOGIN_PATH}?redirectTo=${encodeURIComponent(returnTo)}`;
  }
  if (error instanceof PasswordChangeRequiredError) {
    return CHANGE_PASSWORD_PATH;
  }
  throw error;
}
