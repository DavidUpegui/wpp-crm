/**
 * Builds a Better Auth instance with ALL our options (storage, passwords, sessions,
 * the disabled-account hook).
 *
 * Better Auth is used as a LIBRARY only: our adapters call `auth.api.*` and
 * `auth.$context` directly from server code. Its HTTP handler is deliberately
 * NOT mounted (there is no `src/app/api/auth/[...all]/route.ts`), because its
 * endpoints (sign-up, sign-in, …) would bypass our own rules: the login rate
 * limit, admin permissions and last-admin protection (plan §11). All business
 * rules live in our use cases; this file only configures storage, passwords
 * and sessions.
 *
 * Why a factory, separate from `better-auth.ts`: the real instance needs
 * `server-only`, the env and the database client, which integration tests cannot
 * load. Tests call this factory with the test database, so they exercise exactly
 * the same options as production. This file must stay free of `server-only`, `env`
 * and database-client imports (the database is passed in).
 *
 * Options that shape the database schema live in `better-auth-schema-options.ts`,
 * shared with the generation-only config `better-auth-schema.config.ts`. See that
 * file for the command that regenerates `src/shared/db/schema/auth.ts`.
 */
import { betterAuth, type BetterAuthPlugin, type GenericEndpointContext, type Session } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/modules/users/domain/password-policy";
import type { Database } from "@/shared/db/database";
import * as schema from "@/shared/db/schema";
import { AUTH_DATABASE_PROVIDER, USER_ADDITIONAL_FIELDS } from "./better-auth-schema-options";

/** Error code thrown when a deactivated user signs in; the authenticator adapter maps it. */
export const ACCOUNT_DISABLED_ERROR_CODE = "ACCOUNT_DISABLED";

const SECONDS_PER_DAY = 60 * 60 * 24;

// BR-005: a session lasts 30 days and is extended with activity ("sliding" session).
const SESSION_EXPIRES_IN_SECONDS = 30 * SECONDS_PER_DAY;

// How often an active session gets its expiry pushed forward (at most once a day).
const SESSION_UPDATE_AGE_SECONDS = SECONDS_PER_DAY;

// BR-006: deactivation and password resets must end sessions immediately, so every
// request reads the session from the database. We deliberately keep the cookie cache
// OFF, unlike the Better Auth skill's example (it would keep revoked sessions alive
// for the cache's lifetime).
const IS_SESSION_COOKIE_CACHE_ENABLED = false;

// Behind a reverse proxy the client IP arrives in these headers (stored on the session
// and used by the login rate limit).
const CLIENT_IP_ADDRESS_HEADERS = ["x-forwarded-for", "x-real-ip"];

/** What changes between the real instance and the test instances. */
export type CreateBetterAuthConfig = {
  database: Database;
  /** Signs the session cookie; at least 32 random characters. Never log it. */
  secret: string;
  baseURL: string;
  /** Extra plugins, e.g. `nextCookies()` in the real instance (it must be the LAST one). */
  plugins?: BetterAuthPlugin[];
};

/** Creates a Better Auth instance with our options (see the file comment). */
export function createBetterAuth(config: CreateBetterAuthConfig) {
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    database: drizzleAdapter(config.database, { provider: AUTH_DATABASE_PROVIDER, schema }),
    emailAndPassword: {
      enabled: true,
      // Only admins create users, through our own use case (US-7).
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
    },
    user: { additionalFields: USER_ADDITIONAL_FIELDS },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      cookieCache: { enabled: IS_SESSION_COOKIE_CACHE_ENABLED },
    },
    databaseHooks: {
      session: {
        create: {
          before: rejectSessionForDisabledAccount,
        },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: CLIENT_IP_ADDRESS_HEADERS },
    },
    plugins: config.plugins ?? [],
  });
}

/** A Better Auth instance built by `createBetterAuth`; the adapters receive it in their constructor. */
export type Auth = ReturnType<typeof createBetterAuth>;

/**
 * Blocks a deactivated user from getting a session (BR-003, AC-1.3).
 *
 * Why here: Better Auth creates the session only AFTER the password was verified,
 * so the "account disabled" state is revealed only to someone who knows the correct
 * password. A wrong password keeps failing with the generic error.
 */
async function rejectSessionForDisabledAccount(
  session: Session,
  context: GenericEndpointContext | null,
): Promise<void> {
  if (!context) {
    // Without the request context we cannot check the account; fail closed.
    throw new Error("Cannot create a session without a Better Auth request context");
  }

  const user = await context.context.internalAdapter.findUserById(session.userId);
  const isDisabled = user !== null && (user as { isActive?: unknown }).isActive === false;

  if (isDisabled) {
    throw APIError.from("FORBIDDEN", {
      code: ACCOUNT_DISABLED_ERROR_CODE,
      message: "Account disabled",
    });
  }
}
