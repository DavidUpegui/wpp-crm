import "server-only";
import { makeChangeOwnPassword } from "@/modules/auth/application/change-own-password";
import { makeGetCurrentUser } from "@/modules/auth/application/get-current-user";
import { makeLogIn } from "@/modules/auth/application/log-in";
import { makeLogOut } from "@/modules/auth/application/log-out";
import { makeRequireCurrentUser } from "@/modules/auth/application/require-current-user";
import { makeUpdateOwnName } from "@/modules/auth/application/update-own-name";
import { auth } from "@/modules/auth/infrastructure/better-auth";
import { BetterAuthAuthenticator } from "@/modules/auth/infrastructure/better-auth-authenticator";
import { BetterAuthPasswordHasher } from "@/modules/auth/infrastructure/better-auth-password-hasher";
import { BetterAuthSessionReader } from "@/modules/auth/infrastructure/better-auth-session-reader";
import { BetterAuthSessionRevoker } from "@/modules/auth/infrastructure/better-auth-session-revoker";
import { DrizzleLoginAttemptRepository } from "@/modules/auth/infrastructure/drizzle-login-attempt-repository";
import { makeCreateFirstAdmin } from "@/modules/users/application/create-first-admin";
import { makeCreateUser } from "@/modules/users/application/create-user";
import { makeDeactivateUser } from "@/modules/users/application/deactivate-user";
import { makeListUsers } from "@/modules/users/application/list-users";
import { makeReactivateUser } from "@/modules/users/application/reactivate-user";
import { makeResetUserPassword } from "@/modules/users/application/reset-user-password";
import { makeUpdateUser } from "@/modules/users/application/update-user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/drizzle-user-repository";
import { DrizzleUserTransactionRunner } from "@/modules/users/infrastructure/drizzle-user-transaction-runner";
import { db } from "@/shared/db/client";

/**
 * Composition root — the ONLY place that knows which concrete class
 * implements each interface (Dependency Inversion Principle, AGENTS.md §5.3 D).
 *
 * Use cases depend on interfaces (`UserRepository`, `Authenticator`, …) and
 * receive them as arguments. This file builds them with the real Drizzle and
 * Better Auth implementations and exports the ready-to-use use cases.
 *
 * - Routes, server actions and scripts import use cases from HERE only.
 * - Only use cases are exported, never repositories or adapters, so delivery
 *   code cannot skip the business rules by talking to the database directly.
 * - Tests do not import this file: they build the same use cases with
 *   in-memory fakes (see `src/modules/<feature>/application/testing/`).
 *
 * Importing this file only creates plain objects; the database connection
 * pool lives in `@/shared/db/client` and opens connections lazily.
 */

// ---------------------------------------------------------------------------
// Infrastructure (concrete implementations, private to this file)
// ---------------------------------------------------------------------------

const userRepository = new DrizzleUserRepository(db);
// Use cases that write several rows (user + credential) get their
// repositories from the transaction runner, so no standalone
// credential repository is needed here.
const userTransactionRunner = new DrizzleUserTransactionRunner(db);
const loginAttemptRepository = new DrizzleLoginAttemptRepository(db);

const authenticator = new BetterAuthAuthenticator(auth);
const sessionReader = new BetterAuthSessionReader(auth);
const passwordHasher = new BetterAuthPasswordHasher(auth);
const sessionRevoker = new BetterAuthSessionRevoker(auth);

/**
 * The real clock. Use cases receive it instead of calling `new Date()`
 * themselves, so tests can pass a fixed time (e.g. for the 15-minute
 * login-block window, BR-004).
 */
const now = (): Date => new Date();

// ---------------------------------------------------------------------------
// Users use cases (admin user management)
// ---------------------------------------------------------------------------

export const createFirstAdmin = makeCreateFirstAdmin({
  transactionRunner: userTransactionRunner,
  passwordHasher,
});

export const createUser = makeCreateUser({
  transactionRunner: userTransactionRunner,
  passwordHasher,
});

export const listUsers = makeListUsers({ userRepository });

export const updateUser = makeUpdateUser({ transactionRunner: userTransactionRunner });

export const deactivateUser = makeDeactivateUser({
  transactionRunner: userTransactionRunner,
  sessionRevoker,
});

export const reactivateUser = makeReactivateUser({ userRepository });

export const resetUserPassword = makeResetUserPassword({
  transactionRunner: userTransactionRunner,
  passwordHasher,
  sessionRevoker,
});

// ---------------------------------------------------------------------------
// Auth use cases (login, session and own account)
// ---------------------------------------------------------------------------

export const logIn = makeLogIn({
  loginAttemptRepository,
  authenticator,
  userRepository,
  now,
});

export const logOut = makeLogOut({ authenticator });

export const getCurrentUser = makeGetCurrentUser({ sessionReader, userRepository });

// Built on top of `getCurrentUser`, so both always agree on who is logged in.
export const requireCurrentUser = makeRequireCurrentUser({ getCurrentUser });

export const changeOwnPassword = makeChangeOwnPassword({
  transactionRunner: userTransactionRunner,
  passwordHasher,
  sessionRevoker,
});

export const updateOwnName = makeUpdateOwnName({ userRepository });
