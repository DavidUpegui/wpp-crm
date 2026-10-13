import { z } from "zod";

import { ConversationNotFoundError } from "@/modules/conversations/domain/errors";

/**
 * The second argument Next.js 16 passes to every `/api/conversations/[id]/...` handler.
 * `params` is a Promise in Next.js 16 and must be awaited.
 */
export type ConversationIdRouteContext = {
  params: Promise<{ id: string }>;
};

const conversationIdSchema = z.uuid();

/**
 * Reads the `:id` segment shared by all `/api/conversations/[id]/...` routes.
 *
 * Why a 404 and not a 422: an id that is not a UUID can never match a
 * conversation, so it is answered exactly like a missing one (AC-4.4). It also
 * keeps a malformed id from reaching the database's `uuid` column.
 *
 * @throws ConversationNotFoundError when the id is not a UUID.
 */
export async function parseConversationIdParams(context: ConversationIdRouteContext): Promise<string> {
  const { id } = await context.params;

  const result = conversationIdSchema.safeParse(id);
  if (!result.success) {
    throw new ConversationNotFoundError();
  }
  return result.data;
}
