/**
 * The Better Auth options that shape the DATABASE SCHEMA, in one place.
 *
 * Why a separate file: the schema generator (`auth@1.7.6 generate`) cannot load
 * `better-auth.ts`, because that file imports `server-only` (and the env and the
 * database client). So both the real options (`create-better-auth.ts`, used by
 * `better-auth.ts`) and the generation-only config (`better-auth-schema.config.ts`) read these values from
 * here, and they can never drift apart.
 *
 * This file must stay free of `server-only`, `env` and database imports.
 */
import type { DBFieldAttribute } from "better-auth";

/** Our database is PostgreSQL (Drizzle adapter provider). */
export const AUTH_DATABASE_PROVIDER = "pg";

/**
 * Extra columns on Better Auth's `user` table.
 *
 * `input: false`: these can never be set through Better Auth's own inputs;
 * only our use cases change them.
 */
export const USER_ADDITIONAL_FIELDS = {
  role: { type: "string", required: true, defaultValue: "agent", input: false },
  isActive: { type: "boolean", required: true, defaultValue: true, input: false },
  mustChangePassword: { type: "boolean", required: true, defaultValue: true, input: false },
  lastLoginAt: { type: "date", required: false, input: false },
} satisfies Record<string, DBFieldAttribute>;
