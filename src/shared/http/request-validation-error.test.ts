import { describe, expect, it } from "vitest";

import { AppError } from "@/shared/errors/app-error";

import { RequestValidationError } from "./request-validation-error";

describe("RequestValidationError", () => {
  it("is an AppError with the VALIDATION_ERROR code and the given field errors", () => {
    // Arrange
    const fieldErrors = { email: ["Invalid email"] };

    // Act
    const error = new RequestValidationError(fieldErrors);

    // Assert
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fieldErrors).toEqual(fieldErrors);
  });
});
