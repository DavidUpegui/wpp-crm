import { afterEach, describe, expect, it, vi } from "vitest";

import * as authErrors from "@/modules/auth/domain/errors";
import * as usersErrors from "@/modules/users/domain/errors";
import { AppError } from "@/shared/errors/app-error";

import { ERROR_STATUS_BY_CODE, toErrorResponse } from "./json-error-response";
import { RequestValidationError } from "./request-validation-error";

/** One instance of every known AppError class, so a new class without a status row fails a test. */
function buildEveryKnownError(): AppError[] {
  return [
    new usersErrors.PasswordPolicyError("too_short"),
    new usersErrors.EmailAlreadyInUseError(),
    new usersErrors.LastActiveAdminError(),
    new usersErrors.CannotModifyOwnAccountError(),
    new usersErrors.UserNotFoundError(),
    new usersErrors.ForbiddenError(),
    new usersErrors.NewPasswordSameAsCurrentError(),
    new usersErrors.FirstAdminAlreadyExistsError(),
    new usersErrors.EmptyNameError(),
    new authErrors.InvalidCredentialsError(),
    new authErrors.AccountDisabledError(),
    new authErrors.TooManyLoginAttemptsError(),
    new authErrors.UnauthenticatedError(),
    new authErrors.PasswordChangeRequiredError(),
    new authErrors.WrongCurrentPasswordError(),
    new RequestValidationError({ email: ["Invalid email"] }),
  ];
}

class UnmappedTestError extends AppError {
  constructor() {
    super("SOME_UNMAPPED_CODE", "secret internal detail");
  }
}

afterEach(() => vi.restoreAllMocks());

describe("ERROR_STATUS_BY_CODE", () => {
  it("lists every error class exported by the domain error modules", () => {
    // Arrange
    const exportedClasses = [...Object.values(usersErrors), ...Object.values(authErrors)].filter(
      (value) => typeof value === "function",
    );
    const builtClasses = new Set(buildEveryKnownError().map((error) => error.constructor));

    // Act
    const missing = exportedClasses.filter((errorClass) => !builtClasses.has(errorClass));

    // Assert
    expect(missing).toEqual([]);
  });

  it("has a status for every known error code", () => {
    // Arrange
    const codes = buildEveryKnownError().map((error) => error.code);

    // Act
    const unmapped = codes.filter((code) => ERROR_STATUS_BY_CODE[code] === undefined);

    // Assert
    expect(unmapped).toEqual([]);
  });
});

describe("toErrorResponse", () => {
  it.each([
    [new authErrors.UnauthenticatedError(), 401],
    [new authErrors.InvalidCredentialsError(), 401],
    [new usersErrors.ForbiddenError(), 403],
    [new authErrors.PasswordChangeRequiredError(), 403],
    [new usersErrors.UserNotFoundError(), 404],
    [new usersErrors.LastActiveAdminError(), 409],
    [new authErrors.WrongCurrentPasswordError(), 422],
    [new authErrors.TooManyLoginAttemptsError(), 429],
  ])("answers %s with status %i and its code and message", async (error, expectedStatus) => {
    // Act
    const response = toErrorResponse(error);

    // Assert
    expect(response.status).toBe(expectedStatus);
    expect(await response.json()).toEqual({ error: { code: error.code, message: error.message } });
  });

  it("includes the failed rule for password policy errors", async () => {
    // Arrange
    const error = new usersErrors.PasswordPolicyError("too_long");

    // Act
    const response = toErrorResponse(error);

    // Assert
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "PASSWORD_POLICY", message: error.message, reason: "too_long" },
    });
  });

  it("includes the field errors for validation errors", async () => {
    // Arrange
    const error = new RequestValidationError({ email: ["Invalid email"] });

    // Act
    const response = toErrorResponse(error);

    // Assert
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: error.message, fieldErrors: { email: ["Invalid email"] } },
    });
  });

  it("answers unexpected errors with a generic 500 and logs them on the server only", async () => {
    // Arrange
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("database password is hunter2");

    // Act
    const response = toErrorResponse(error);

    // Assert
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
  });

  it("treats an AppError without a status row as unexpected", async () => {
    // Arrange
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const response = toErrorResponse(new UnmappedTestError());

    // Assert
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret internal detail");
  });

  it("answers non-Error thrown values with a generic 500", async () => {
    // Arrange
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const response = toErrorResponse("just a string");

    // Assert
    expect(response.status).toBe(500);
  });
});
