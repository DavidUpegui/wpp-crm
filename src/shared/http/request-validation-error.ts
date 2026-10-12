import { AppError } from "@/shared/errors/app-error";

/**
 * Field name → list of problems with that field, e.g. `{ email: ["Invalid email"] }`.
 * Errors that do not belong to one field (like "the body is not JSON") use the key `_form`.
 */
export type FieldErrors = Record<string, string[]>;

/**
 * Thrown when a request body is not valid JSON or does not match the expected shape.
 * Carries `fieldErrors` so API clients and forms can show which fields are wrong.
 */
export class RequestValidationError extends AppError {
  /** The problems found, grouped by field name. */
  public readonly fieldErrors: FieldErrors;

  constructor(fieldErrors: FieldErrors) {
    super("VALIDATION_ERROR", "The request data is invalid.");
    this.fieldErrors = fieldErrors;
  }
}
