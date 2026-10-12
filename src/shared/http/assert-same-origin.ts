import { ForbiddenError } from "@/shared/errors/forbidden-error";

const CROSS_SITE = "cross-site";

/**
 * CSRF protection for mutating requests (POST, PATCH, DELETE). Do not call it for GET.
 *
 * Rejects the request when the browser says it comes from another site:
 * - the `Origin` header is present and is not `allowedOrigin`, or
 * - `Sec-Fetch-Site` is `cross-site`.
 *
 * Requests with neither header (curl, Postman, scripts) are allowed on purpose:
 * a CSRF attack needs a victim's browser, browsers always send `Origin` on
 * cross-origin POST/PATCH/DELETE, and the REST API must stay usable from
 * non-browser clients (FR-008). Those clients still need a valid session.
 *
 * @param allowedOrigin The app's own URL (e.g. `BETTER_AUTH_URL`); only its origin is compared.
 * @throws ForbiddenError when the request is cross-site.
 */
export function assertSameOrigin(request: Request, allowedOrigin: string): void {
  const expectedOrigin = new URL(allowedOrigin).origin;

  const originHeader = request.headers.get("origin");
  if (originHeader !== null && originHeader !== expectedOrigin) {
    throw new ForbiddenError();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === CROSS_SITE) {
    throw new ForbiddenError();
  }
}
