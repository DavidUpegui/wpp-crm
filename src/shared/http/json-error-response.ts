import { AppError } from "@/shared/errors/app-error";

import { RequestValidationError } from "./request-validation-error";

/**
 * HTTP status for every `AppError` code (plan §7).
 *
 * Adding a new error? Add one row here. A test fails if an error class has no row.
 */
export const ERROR_STATUS_BY_CODE: Record<string, number> = {
  // 401: who are you?
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  // 403: we know who you are, but you cannot do this
  FORBIDDEN: 403,
  ACCOUNT_DISABLED: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  // 404: the thing does not exist
  USER_NOT_FOUND: 404,
  // 409: conflicts with the current state
  EMAIL_ALREADY_IN_USE: 409,
  LAST_ACTIVE_ADMIN: 409,
  CANNOT_MODIFY_OWN_ACCOUNT: 409,
  FIRST_ADMIN_EXISTS: 409,
  // 422: the data sent is not acceptable
  VALIDATION_ERROR: 422,
  PASSWORD_POLICY: 422,
  NEW_PASSWORD_SAME_AS_CURRENT: 422,
  WRONG_CURRENT_PASSWORD: 422,
  NAME_REQUIRED: 422,
  // 429: slow down
  TOO_MANY_LOGIN_ATTEMPTS: 429,
};

const INTERNAL_ERROR_STATUS = 500;
const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";
const INTERNAL_ERROR_MESSAGE = "Something went wrong";

/** Body shape of every JSON error response: `{ error: { code, message, ...details } }`. */
export interface JsonErrorBody {
  error: {
    code: string;
    message: string;
    [detail: string]: unknown;
  };
}

/**
 * Turns any thrown value into a JSON error `Response` for the REST API.
 *
 * Why: handlers just `catch (error) { return toErrorResponse(error); }` and
 * every endpoint answers errors the same way. Known errors (`AppError` with a
 * mapped code) get their status and English message; the UI maps the `code`
 * to Spanish text. Anything else is a bug: it gets a generic 500 so no
 * internal details leak to the client.
 */
export function toErrorResponse(error: unknown): Response {
  if (!(error instanceof AppError)) {
    return internalErrorResponse(error);
  }

  const status = ERROR_STATUS_BY_CODE[error.code];
  if (status === undefined) {
    return internalErrorResponse(error);
  }

  const body: JsonErrorBody = {
    error: { code: error.code, message: error.message, ...detailsOf(error) },
  };
  return Response.json(body, { status });
}

/** Extra, safe fields some errors carry (`AppError.details`) so clients can show a precise message. */
function detailsOf(error: AppError): Record<string, unknown> {
  if (error instanceof RequestValidationError) {
    return { fieldErrors: error.fieldErrors };
  }
  return { ...error.details };
}

function internalErrorResponse(error: unknown): Response {
  // Server log only, so we can debug the bug; never sent to the client.
  console.error("Unexpected error while handling a request:", error);

  const body: JsonErrorBody = {
    error: { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE },
  };
  return Response.json(body, { status: INTERNAL_ERROR_STATUS });
}
