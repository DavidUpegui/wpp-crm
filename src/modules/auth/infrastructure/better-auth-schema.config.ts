/**
 * Generation-only Better Auth config. NEVER import this from application code.
 *
 * Why it exists: `auth@1.7.6 generate` loads its config with jiti, which cannot
 * resolve `import "server-only"` (used by the real instance in `better-auth.ts`, whose options live in
 * `create-better-auth.ts`),
 * and the real instance also needs the env and a database connection. This file
 * builds an instance with only the schema-affecting options, shared through
 * `better-auth-schema-options.ts`, so the generated schema always matches the real
 * instance.
 *
 * Regenerate `src/shared/db/schema/auth.ts` (don't edit it by hand) with:
 *
 *   pnpm dlx auth@1.7.6 generate \
 *     --config src/modules/auth/infrastructure/better-auth-schema.config.ts \
 *     --output src/shared/db/schema/auth.ts -y
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { AUTH_DATABASE_PROVIDER, USER_ADDITIONAL_FIELDS } from "./better-auth-schema-options";

// The generator only reads the adapter's options (provider, naming); it never
// queries the database, so an empty object stands in for the Drizzle client.
const GENERATION_ONLY_DATABASE = {};

export const auth = betterAuth({
  database: drizzleAdapter(GENERATION_ONLY_DATABASE, { provider: AUTH_DATABASE_PROVIDER }),
  emailAndPassword: { enabled: true },
  user: { additionalFields: USER_ADDITIONAL_FIELDS },
});
