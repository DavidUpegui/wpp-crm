import { isAPIError } from "better-auth/api";

import type { Authenticator, SignInCredentials } from "@/modules/auth/domain/authenticator";
import { AccountDisabledError, InvalidCredentialsError } from "@/modules/auth/domain/errors";

import { ACCOUNT_DISABLED_ERROR_CODE, type Auth } from "./create-better-auth";

// How Better Auth 1.7.6 errors from `signInEmail` become our domain errors:
//
// | Better Auth `body.code`       | When                                        | Domain error              |
// |-------------------------------|---------------------------------------------|---------------------------|
// | ACCOUNT_DISABLED (ours)       | correct password, inactive user (our hook)  | AccountDisabledError      |
// | INVALID_EMAIL_OR_PASSWORD     | unknown email, wrong password, no password  | InvalidCredentialsError   |
// | INVALID_EMAIL                 | the email is not a valid address            | InvalidCredentialsError   |
// | PASSWORD_TOO_LONG             | password longer than the maximum            | InvalidCredentialsError   |
// | VALIDATION_ERROR              | body fails Better Auth's schema             | InvalidCredentialsError   |
// | anything else (5xx, unknown)  | real failures                               | rethrown unchanged        |
//
// Input problems map to the SAME generic error as a wrong password, so the
// response never reveals anything about the account (BR-003).
const INVALID_CREDENTIALS_ERROR_CODES = new Set([
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "PASSWORD_TOO_LONG",
  "VALIDATION_ERROR",
]);

/**
 * `Authenticator` backed by Better Auth (FR-001, FR-005). The session cookie is
 * set and cleared by Better Auth itself (through `nextCookies()` in the real app).
 */
export class BetterAuthAuthenticator implements Authenticator {
  constructor(private readonly auth: Auth) {}

  async signIn({ email, password, requestHeaders }: SignInCredentials): Promise<{ userId: string }> {
    try {
      const result = await this.auth.api.signInEmail({
        body: { email, password },
        headers: requestHeaders,
      });
      return { userId: result.user.id };
    } catch (error) {
      throw toDomainSignInError(error);
    }
  }

  /**
   * Better Auth 1.7.6 does not throw when the request has no session (it only
   * deletes the session if there is one and clears the cookie), so calling this
   * twice is safe. Any error it does throw is a real failure and is rethrown.
   */
  async signOut(requestHeaders: Headers): Promise<void> {
    await this.auth.api.signOut({ headers: requestHeaders });
  }
}

/** Maps a Better Auth sign-in error to our domain error, or returns it unchanged (see the table above). */
function toDomainSignInError(error: unknown): unknown {
  if (!isAPIError(error)) {
    return error;
  }

  const errorCode = error.body?.code;
  if (errorCode === ACCOUNT_DISABLED_ERROR_CODE) {
    return new AccountDisabledError();
  }
  if (errorCode !== undefined && INVALID_CREDENTIALS_ERROR_CODES.has(errorCode)) {
    return new InvalidCredentialsError();
  }
  return error;
}
