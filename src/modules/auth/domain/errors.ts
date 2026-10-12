// All intentional errors of the auth module (each extends `AppError` with a
// stable `code`). Messages are in English and never contain emails or other
// personal data, because errors may be logged.
//
// `ForbiddenError` is not repeated here: auth code imports it from
// `@/modules/users/domain/errors`.

import { AppError } from "@/shared/errors/app-error";

/**
 * Thrown when the email or password is wrong (AC-1.2).
 * The message is the same in both cases, so it never reveals whether
 * the email exists (BR-003).
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super("INVALID_CREDENTIALS", "The email or password is incorrect.");
  }
}

/**
 * Thrown when a deactivated user logs in with the correct password (AC-1.3).
 * Only raised after the password was verified, so it does not reveal
 * anything to someone who does not know the password (BR-003).
 */
export class AccountDisabledError extends AppError {
  constructor() {
    super("ACCOUNT_DISABLED", "This account is deactivated.");
  }
}

/** Thrown when there were too many failed logins for this email + IP recently (BR-004, AC-1.5). */
export class TooManyLoginAttemptsError extends AppError {
  constructor() {
    super("TOO_MANY_LOGIN_ATTEMPTS", "Too many failed login attempts. Try again in a few minutes.");
  }
}

/** Thrown when a request has no valid session (FR-006, AC-3.4). */
export class UnauthenticatedError extends AppError {
  constructor() {
    super("UNAUTHENTICATED", "You must be logged in to perform this action.");
  }
}

/** Thrown when a user with a temporary password tries anything except changing it or logging out (BR-011, AC-4.1). */
export class PasswordChangeRequiredError extends AppError {
  constructor() {
    super("PASSWORD_CHANGE_REQUIRED", "You must change your temporary password before continuing.");
  }
}

/** Thrown when the current password given to change it is wrong (AC-5.3). */
export class WrongCurrentPasswordError extends AppError {
  constructor() {
    super("WRONG_CURRENT_PASSWORD", "The current password is incorrect.");
  }
}
