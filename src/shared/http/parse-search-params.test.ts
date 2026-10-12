import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseSearchParams } from "./parse-search-params";
import { RequestValidationError } from "./request-validation-error";

const filtersSchema = z.object({
  role: z.enum(["admin", "agent"]).optional(),
  search: z.string().optional(),
});

function catchError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the action to throw");
}

describe("parseSearchParams", () => {
  it("returns the parsed query when it matches the schema", () => {
    // Act
    const data = parseSearchParams("http://localhost/api/users?role=agent&search=ana", filtersSchema);

    // Assert
    expect(data).toEqual({ role: "agent", search: "ana" });
  });

  it("returns an empty object when there is no query string", () => {
    // Act
    const data = parseSearchParams("http://localhost/api/users", filtersSchema);

    // Assert
    expect(data).toEqual({});
  });

  it("uses the first value when a parameter is repeated", () => {
    // Act
    const data = parseSearchParams("http://localhost/api/users?role=admin&role=nope", filtersSchema);

    // Assert
    expect(data).toEqual({ role: "admin" });
  });

  it("throws a validation error naming the wrong parameter", () => {
    // Act
    const error = catchError(() => parseSearchParams("http://localhost/api/users?role=owner", filtersSchema));

    // Assert
    expect(error).toBeInstanceOf(RequestValidationError);
    expect(Object.keys((error as RequestValidationError).fieldErrors)).toEqual(["role"]);
  });
});
