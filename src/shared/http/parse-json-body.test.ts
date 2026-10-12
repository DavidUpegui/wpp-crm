import { describe, expect, it } from "vitest";
import { z } from "zod";

import { FORM_ERROR_KEY, parseJsonBody } from "./parse-json-body";
import { RequestValidationError } from "./request-validation-error";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function jsonRequest(body: string): Request {
  return new Request("http://localhost/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

describe("parseJsonBody", () => {
  it("returns the parsed data when the body matches the schema", async () => {
    // Arrange
    const request = jsonRequest(JSON.stringify({ email: "ana@example.com", password: "secret" }));

    // Act
    const data = await parseJsonBody(request, loginSchema);

    // Assert
    expect(data).toEqual({ email: "ana@example.com", password: "secret" });
  });

  it("throws a validation error when the body is not valid JSON", async () => {
    // Arrange
    const request = jsonRequest("{not json");

    // Act
    const error = await catchError(parseJsonBody(request, loginSchema));

    // Assert
    expect(error).toBeInstanceOf(RequestValidationError);
    expect((error as RequestValidationError).fieldErrors[FORM_ERROR_KEY]).toHaveLength(1);
  });

  it("throws a validation error listing the wrong fields when the body breaks the schema", async () => {
    // Arrange
    const request = jsonRequest(JSON.stringify({ email: "not-an-email" }));

    // Act
    const error = await catchError(parseJsonBody(request, loginSchema));

    // Assert
    expect(error).toBeInstanceOf(RequestValidationError);
    const fieldErrors = (error as RequestValidationError).fieldErrors;
    expect(Object.keys(fieldErrors).sort()).toEqual(["email", "password"]);
  });

  it("reports a non-object body as a form error", async () => {
    // Arrange
    const request = jsonRequest("42");

    // Act
    const error = await catchError(parseJsonBody(request, loginSchema));

    // Assert
    expect(error).toBeInstanceOf(RequestValidationError);
    expect((error as RequestValidationError).fieldErrors[FORM_ERROR_KEY]).toBeDefined();
  });
});
