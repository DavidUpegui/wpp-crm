import { PasswordPolicyError } from "./errors";

/** Fewest characters a password may have (BR-002). */
export const MIN_PASSWORD_LENGTH = 10;

/** Most characters a password may have (BR-002, spec §12 "Password longer than 128"). */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Throws `PasswordPolicyError` when the password breaks the length policy
 * (BR-002); returns normally when it is acceptable.
 *
 * Why one function: every place that sets a password (create user, reset,
 * change own password, first admin setup) must apply exactly the same rule.
 *
 * Length is counted as JavaScript `string.length` (UTF-16 code units), which
 * is simple and matches Better Auth's own min/max length checks.
 *
 * Note: "the new password must differ from the current one" (also BR-002)
 * is checked elsewhere, because it needs the stored password hash.
 */
export function assertPasswordMeetsPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordPolicyError("too_short");
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new PasswordPolicyError("too_long");
  }
}
