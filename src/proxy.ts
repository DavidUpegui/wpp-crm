/**
 * Optimistic login redirect (AC-3.1, FR-009).
 *
 * This proxy only checks whether a Better Auth session cookie EXISTS. It does not
 * validate it. Its only purpose is to avoid rendering protected pages for visitors
 * who are obviously logged out, sending them to `/login?redirectTo=<requested page>`
 * so they come back to that page after logging in.
 *
 * It must NEVER be the only protection: the real check (valid session, active user,
 * role, pending password change) always happens on the server, in layouts and
 * route handlers (AGENTS.md §12). A forged or expired cookie passes this proxy and
 * is rejected there.
 *
 * It stays light on purpose: it runs before rendering, so it must not import our
 * Better Auth server instance, the database or `env`.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { CURRENT_PATH_HEADER } from "@/shared/http/current-path-header";

const LOGIN_PATH = "/login";
const REDIRECT_TO_PARAMETER = "redirectTo";

// Better Auth defaults (our config does not override them). `getSessionCookie` also
// accepts the `__Secure-` prefixed variant used over https.
const SESSION_COOKIE_OPTIONS = {
  cookiePrefix: "better-auth",
  cookieName: "session_token",
};

/**
 * Redirects visitors without a session cookie to the login page; lets everyone
 * else through, telling the app which page was requested (see `CURRENT_PATH_HEADER`).
 */
export function proxy(request: NextRequest): NextResponse {
  const hasSessionCookie = getSessionCookie(request, SESSION_COOKIE_OPTIONS) !== null;
  if (hasSessionCookie) {
    return continueWithCurrentPath(request);
  }
  return NextResponse.redirect(buildLoginUrl(request));
}

/**
 * Paths the proxy runs on: everything EXCEPT
 * - `/api/*`: API routes answer 401 JSON themselves; API calls are never redirected.
 * - `/_next/*`: Next.js internals (scripts, styles, image optimization).
 * - `/login` and `/change-password`: public / guarded by their own server check.
 * - `favicon.ico` and any path ending in a file extension (static assets).
 */
export const config = {
  matcher: [
    "/((?!api/|api$|_next/|login$|change-password$|favicon\\.ico$|.*\\.[^/]+$).*)",
  ],
};

/**
 * Forwards the request with the requested `pathname + search` in a request header.
 *
 * Why: layouts cannot read the URL. When the cookie turns out to be expired or
 * forged, the app layout uses this header to send the user to
 * `/login?redirectTo=<this page>` (AC-3.6). `set` overwrites any value the
 * browser sent, and the layout re-checks it with `safeRedirectPath` anyway.
 * `request.headers` (not response headers) keeps it on the server side.
 */
function continueWithCurrentPath(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CURRENT_PATH_HEADER, pathname + search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Builds `/login?redirectTo=<path + query>` on the same origin as the request.
 * The login page sanitizes `redirectTo` with `safeRedirectPath`, so no check here.
 */
function buildLoginUrl(request: NextRequest): URL {
  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set(REDIRECT_TO_PARAMETER, pathname + search);
  return loginUrl;
}
