import { z } from "zod";

import { RequestValidationError } from "@/shared/http/request-validation-error";

/**
 * The second argument Next.js 16 passes to every `/api/users/[id]/...` handler.
 * `params` is a Promise in Next.js 16 and must be awaited.
 */
export type UserIdRouteContext = {
  params: Promise<{ id: string }>;
};

const userIdSchema = z.string().trim().min(1);

/**
 * Reads the `:id` segment shared by all `/api/users/[id]/...` routes.
 *
 * Why: four routes need the same "await params, check the id" steps. The id
 * is only checked to be non-empty: an id that matches nobody is answered
 * `USER_NOT_FOUND` by the use case.
 *
 * @throws RequestValidationError when the id is empty.
 */
export async function parseUserIdParams(context: UserIdRouteContext): Promise<string> {
  const { id } = await context.params;

  const result = userIdSchema.safeParse(id);
  if (!result.success) {
    throw new RequestValidationError({ id: ["The user id must not be empty."] });
  }
  return result.data;
}
