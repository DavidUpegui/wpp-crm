import { z } from "zod";

import { type FieldErrors, RequestValidationError } from "./request-validation-error";

/** Key used in `fieldErrors` for problems that are not about one specific field. */
export const FORM_ERROR_KEY = "_form";

const INVALID_JSON_MESSAGE = "The request body must be valid JSON.";

/**
 * Reads a request body as JSON and validates it with a Zod schema.
 *
 * Why: every REST handler needs the same "parse, validate, answer 422" steps;
 * doing them here keeps handlers short and the error format identical.
 *
 * @throws RequestValidationError when the body is not JSON or does not match the schema.
 */
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const body = await readJson(request);

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new RequestValidationError(toFieldErrors(result.error));
  }
  return result.data;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RequestValidationError({ [FORM_ERROR_KEY]: [INVALID_JSON_MESSAGE] });
  }
}

/**
 * Turns a Zod error into `fieldErrors` (field → messages, `_form` for the rest).
 * Exported so `parseSearchParams` answers in exactly the same format.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const flattened = z.flattenError(error);
  const fieldErrors: FieldErrors = {};

  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[field] = messages as string[];
    }
  }
  if (flattened.formErrors.length > 0) {
    fieldErrors[FORM_ERROR_KEY] = flattened.formErrors;
  }
  return fieldErrors;
}
