import { z } from "zod";

import { toFieldErrors } from "./parse-json-body";
import { RequestValidationError } from "./request-validation-error";

/**
 * Reads the query string of a request URL and validates it with a Zod schema.
 *
 * Why: `GET` endpoints with filters (e.g. `/api/users?role=admin`) need the
 * same "validate, answer 422 with fieldErrors" behavior as JSON bodies.
 * Every parameter arrives as a string; when a name is repeated, the first
 * value wins.
 *
 * @throws RequestValidationError when the query does not match the schema.
 */
export function parseSearchParams<T>(url: string, schema: z.ZodType<T>): T {
  const searchParams = new URL(url).searchParams;
  const query: Record<string, string> = {};
  for (const [name, value] of searchParams) {
    if (!(name in query)) {
      query[name] = value;
    }
  }

  const result = schema.safeParse(query);
  if (!result.success) {
    throw new RequestValidationError(toFieldErrors(result.error));
  }
  return result.data;
}
