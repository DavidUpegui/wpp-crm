/**
 * Request header the proxy adds with the requested `pathname + search`.
 *
 * Why: layouts cannot read the URL, but the app layout needs it to send a
 * user whose session expired to `/login?redirectTo=<this page>` (AC-3.6).
 * It is only a hint: whoever reads it must re-check it with `safeRedirectPath`.
 */
export const CURRENT_PATH_HEADER = "x-current-path";
