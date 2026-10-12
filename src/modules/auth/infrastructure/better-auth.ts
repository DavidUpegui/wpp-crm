/**
 * The real Better Auth instance used by the app.
 *
 * All options live in `create-better-auth.ts` (shared with the integration tests);
 * this file only plugs in the server-only pieces: the env secrets, the database
 * client and the Next.js cookie plugin. Only the composition root should import it.
 */
import "server-only";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/shared/config/env";
import { db } from "@/shared/db/client";
import { createBetterAuth } from "./create-better-auth";

export { ACCOUNT_DISABLED_ERROR_CODE, type Auth } from "./create-better-auth";

export const auth = createBetterAuth({
  database: db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // `nextCookies` must stay LAST so Server Actions can set and clear the session cookie.
  plugins: [nextCookies()],
});
