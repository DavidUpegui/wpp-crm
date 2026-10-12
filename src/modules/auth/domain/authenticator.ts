// About `Headers`: it is the web-standard global type (also used by `fetch`),
// not a Next.js import, so the domain may depend on it.

/** What a user types in the login form, plus the request headers the session is tied to. */
export type SignInCredentials = {
  /** Must already be normalized with `normalizeEmail` (BR-001). */
  email: string;
  password: string;
  requestHeaders: Headers;
};

/**
 * Checks passwords and starts or ends login sessions (FR-001, FR-005).
 *
 * Why an interface: the log-in and log-out use cases must not know which
 * auth library is behind it, and tests can pass a fake.
 */
export interface Authenticator {
  /**
   * Verifies the password and creates a session for the user (FR-001).
   * The session cookie is set by the infrastructure, not by the caller.
   *
   * Throws `InvalidCredentialsError` when the email is unknown or the
   * password is wrong (the same error for both, BR-003).
   * Throws `AccountDisabledError` when the password is correct but the
   * account is inactive (AC-1.3).
   */
  signIn(credentials: SignInCredentials): Promise<{ userId: string }>;

  /** Ends the current session (FR-005). Does nothing when there is no session. */
  signOut(requestHeaders: Headers): Promise<void>;
}
