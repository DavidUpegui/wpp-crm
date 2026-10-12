/** Where users go after login when no (safe) `redirectTo` was given. */
export const DEFAULT_REDIRECT_PATH = "/inbox";

/** Fake host used only to check that a path cannot escape to another site. */
const PLACEHOLDER_HOST = "local.invalid";
const PLACEHOLDER_BASE_URL = `http://${PLACEHOLDER_HOST}`;

// Control characters (U+0000–U+001F and U+007F); browsers silently strip some of them.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/**
 * Returns `candidate` only if it is a path inside this app (e.g. `/users?x=1`);
 * otherwise returns `fallback`.
 *
 * Why: the login page accepts `?redirectTo=`. Without this check an attacker could
 * send a link that logs the user in and then sends them to `//evil.com` or
 * `https://evil.com` (open redirect, spec §11).
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT_PATH,
): string {
  if (!candidate) {
    return fallback;
  }
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }
  if (candidate.includes("\\") || CONTROL_CHARACTERS.test(candidate)) {
    return fallback;
  }
  if (!staysOnPlaceholderHost(candidate)) {
    return fallback;
  }
  return candidate;
}

function staysOnPlaceholderHost(candidate: string): boolean {
  try {
    return new URL(candidate, PLACEHOLDER_BASE_URL).host === PLACEHOLDER_HOST;
  } catch {
    return false;
  }
}
