// All intentional errors of the users module (each extends `AppError` with a
// stable `code`). Messages are in English and never contain emails or other
// personal data, because errors may be logged.

import { AppError } from "@/shared/errors/app-error";

/**
 * Which password rule failed, so the UI can show a specific message
 * (AC-4.3, AC-7.3) without parsing the error text.
 */
export type PasswordPolicyViolation = "too_short" | "too_long";

/** Thrown when a password breaks the length policy (BR-002). */
export class PasswordPolicyError extends AppError {
  /** The rule that failed: shorter than the minimum or longer than the maximum. */
  public readonly reason: PasswordPolicyViolation;

  constructor(reason: PasswordPolicyViolation) {
    super("PASSWORD_POLICY", describeViolation(reason), { reason });
    this.reason = reason;
  }
}

function describeViolation(reason: PasswordPolicyViolation): string {
  if (reason === "too_short") {
    return "The password is shorter than the minimum length allowed.";
  }
  return "The password is longer than the maximum length allowed.";
}

/** Thrown when another user already has this email, compared case-insensitively (BR-001, AC-7.2). */
export class EmailAlreadyInUseError extends AppError {
  constructor() {
    super("EMAIL_ALREADY_IN_USE", "A user with this email already exists.");
  }
}

/** Thrown when a change would leave the system without an active admin (BR-008, AC-8.4, AC-9.4). */
export class LastActiveAdminError extends AppError {
  constructor() {
    super("LAST_ACTIVE_ADMIN", "At least one active admin must exist.");
  }
}

/** Thrown when an admin tries to change their own role, deactivate or reset themselves (BR-009, AC-8.3, AC-9.3, AC-10.2). */
export class CannotModifyOwnAccountError extends AppError {
  constructor() {
    super("CANNOT_MODIFY_OWN_ACCOUNT", "Admins cannot perform this action on their own account.");
  }
}

/** Thrown when the requested user does not exist (FR-015, FR-016, FR-017). */
export class UserNotFoundError extends AppError {
  constructor() {
    super("USER_NOT_FOUND", "The user was not found.");
  }
}

// `ForbiddenError` lives in `shared/` (the shared HTTP helpers throw it too);
// re-exported here so the users module keeps importing its errors from one place.
export { ForbiddenError } from "@/shared/errors/forbidden-error";

/** Thrown when the new password is the same as the current or temporary one (BR-002, AC-4.3). */
export class NewPasswordSameAsCurrentError extends AppError {
  constructor() {
    super("NEW_PASSWORD_SAME_AS_CURRENT", "The new password must be different from the current one.");
  }
}

/** Thrown when the first-admin setup command runs but an admin already exists (BR-014, AC-11.2). */
export class FirstAdminAlreadyExistsError extends AppError {
  constructor() {
    super("FIRST_ADMIN_EXISTS", "An admin already exists, so the first-admin setup cannot run.");
  }
}

/** Thrown when a display name is empty or only spaces (AC-5.1, AC-7.3). */
export class EmptyNameError extends AppError {
  constructor() {
    super("NAME_REQUIRED", "The name must not be empty.");
  }
}
