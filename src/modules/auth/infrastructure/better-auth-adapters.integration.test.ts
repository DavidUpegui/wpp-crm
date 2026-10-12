// Integration tests for the Better Auth adapters, against the real Postgres test database
// (`pnpm test:integration`). The Better Auth instance is built with the SAME options as the
// app (`createBetterAuth`), only without `nextCookies()` (there is no Next.js request here).
//
// Users are created with our own repositories and the hash from `BetterAuthPasswordHasher`,
// which also proves that the credentials we store are accepted by Better Auth's sign-in.

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AccountDisabledError, InvalidCredentialsError } from "@/modules/auth/domain/errors";
import type { User } from "@/modules/users/domain/user";
import { DrizzleCredentialRepository } from "@/modules/users/infrastructure/drizzle-credential-repository";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/drizzle-user-repository";
import { session as sessionTable } from "@/shared/db/schema";
import { createTestDatabase, resetAuthTables } from "../../../../tests/integration/test-database";

import { BetterAuthAuthenticator } from "./better-auth-authenticator";
import { BetterAuthPasswordHasher } from "./better-auth-password-hasher";
import { BetterAuthSessionReader } from "./better-auth-session-reader";
import { BetterAuthSessionRevoker } from "./better-auth-session-revoker";
import { createBetterAuth } from "./create-better-auth";

const TEST_SECRET_BYTES = 32;
const TEST_BASE_URL = "http://localhost:3000";

const ANA_EMAIL = "ana@example.com";
const ANA_PASSWORD = "correct-horse-battery";
const WRONG_PASSWORD = "wrong-password-123";

// More than Better Auth's default `findMany` limit (100), to prove nothing is left behind.
const MANY_SESSIONS_COUNT = 105;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const testDatabase = createTestDatabase();
const auth = createBetterAuth({
  database: testDatabase.database,
  // A random secret per run: never a real one, never printed.
  secret: randomBytes(TEST_SECRET_BYTES).toString("hex"),
  baseURL: TEST_BASE_URL,
});

const users = new DrizzleUserRepository(testDatabase.database);
const credentials = new DrizzleCredentialRepository(testDatabase.database);
const authenticator = new BetterAuthAuthenticator(auth);
const sessionReader = new BetterAuthSessionReader(auth);
const passwordHasher = new BetterAuthPasswordHasher(auth);
const sessionRevoker = new BetterAuthSessionRevoker(auth);

beforeEach(async () => {
  await resetAuthTables(testDatabase.database);
});

afterAll(async () => {
  await testDatabase.close();
});

/** Creates an active user whose password hash comes from `BetterAuthPasswordHasher`. */
async function createUserWithPassword(email: string, password: string): Promise<User> {
  const user = await users.create({ name: "Ana", email, role: "agent", mustChangePassword: false });
  await credentials.createForUser(user.id, await passwordHasher.hash(password));
  return user;
}

/**
 * Signs in through Better Auth directly (not our adapter) to get the session cookie,
 * and returns request headers that carry it, like a browser would.
 */
async function signInAndGetCookieHeaders(email: string, password: string): Promise<Headers> {
  const { headers: responseHeaders } = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers(),
    returnHeaders: true,
  });

  // "name=value; Path=/; HttpOnly; …" → "name=value"
  const cookies = responseHeaders.getSetCookie().map((setCookie) => setCookie.split(";")[0]);
  return new Headers({ cookie: cookies.join("; ") });
}

async function countSessionRows(userId: string): Promise<number> {
  const rows = await testDatabase.database.select().from(sessionTable).where(eq(sessionTable.userId, userId));
  return rows.length;
}

async function readSessionId(requestHeaders: Headers): Promise<string> {
  const currentSession = await sessionReader.getCurrentSession(requestHeaders);
  if (!currentSession) {
    throw new Error("Expected a valid session");
  }
  return currentSession.sessionId;
}

describe("BetterAuthAuthenticator", () => {
  it("signs in with correct credentials, returns the user id and creates a session row", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);

    // Act
    const result = await authenticator.signIn({ email: ANA_EMAIL, password: ANA_PASSWORD, requestHeaders: new Headers() });

    // Assert
    expect(result).toEqual({ userId: ana.id });
    expect(await countSessionRows(ana.id)).toBe(1);
  });

  it("rejects a wrong password with InvalidCredentialsError", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);

    // Act + Assert
    await expect(
      authenticator.signIn({ email: ANA_EMAIL, password: WRONG_PASSWORD, requestHeaders: new Headers() }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(await countSessionRows(ana.id)).toBe(0);
  });

  it("rejects an unknown email with InvalidCredentialsError", async () => {
    // Act + Assert
    await expect(
      authenticator.signIn({ email: "nobody@example.com", password: ANA_PASSWORD, requestHeaders: new Headers() }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("rejects a malformed email with the same generic InvalidCredentialsError", async () => {
    // Act + Assert
    await expect(
      authenticator.signIn({ email: "not-an-email", password: ANA_PASSWORD, requestHeaders: new Headers() }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("rejects an inactive user with the correct password with AccountDisabledError and creates no session", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    await users.setStatus(ana.id, "inactive");

    // Act + Assert
    await expect(
      authenticator.signIn({ email: ANA_EMAIL, password: ANA_PASSWORD, requestHeaders: new Headers() }),
    ).rejects.toThrow(AccountDisabledError);
    expect(await countSessionRows(ana.id)).toBe(0);
  });

  it("rejects an inactive user with a wrong password with InvalidCredentialsError, not AccountDisabledError", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    await users.setStatus(ana.id, "inactive");

    // Act + Assert
    await expect(
      authenticator.signIn({ email: ANA_EMAIL, password: WRONG_PASSWORD, requestHeaders: new Headers() }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("signOut ends the current session", async () => {
    // Arrange
    await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    const cookieHeaders = await signInAndGetCookieHeaders(ANA_EMAIL, ANA_PASSWORD);

    // Act
    await authenticator.signOut(cookieHeaders);

    // Assert
    expect(await sessionReader.getCurrentSession(cookieHeaders)).toBeNull();
  });

  it("signOut does nothing when there is no session", async () => {
    // Act + Assert
    await expect(authenticator.signOut(new Headers())).resolves.toBeUndefined();
  });
});

describe("BetterAuthSessionReader", () => {
  it("returns the user id and session id for a request with a valid session cookie", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    const cookieHeaders = await signInAndGetCookieHeaders(ANA_EMAIL, ANA_PASSWORD);
    const [sessionRow] = await testDatabase.database
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, ana.id));

    // Act
    const currentSession = await sessionReader.getCurrentSession(cookieHeaders);

    // Assert
    expect(currentSession).toEqual({ userId: ana.id, sessionId: sessionRow.id });
  });

  it("returns null for a request without a session cookie", async () => {
    // Act + Assert
    expect(await sessionReader.getCurrentSession(new Headers())).toBeNull();
  });
});

describe("BetterAuthSessionRevoker", () => {
  it("revokeAllForUser ends every session of the user", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    const firstDevice = await signInAndGetCookieHeaders(ANA_EMAIL, ANA_PASSWORD);
    const secondDevice = await signInAndGetCookieHeaders(ANA_EMAIL, ANA_PASSWORD);

    // Act
    await sessionRevoker.revokeAllForUser(ana.id);

    // Assert
    expect(await sessionReader.getCurrentSession(firstDevice)).toBeNull();
    expect(await sessionReader.getCurrentSession(secondDevice)).toBeNull();
    expect(await countSessionRows(ana.id)).toBe(0);
  });

  it("revokeAllForUser leaves other users' sessions alone", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    await createUserWithPassword("bruno@example.com", ANA_PASSWORD);
    const brunoDevice = await signInAndGetCookieHeaders("bruno@example.com", ANA_PASSWORD);

    // Act
    await sessionRevoker.revokeAllForUser(ana.id);

    // Assert
    expect(await sessionReader.getCurrentSession(brunoDevice)).not.toBeNull();
  });

  it("revokeAllForUserExcept keeps only the given session", async () => {
    // Arrange
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    const keptDevice = await signInAndGetCookieHeaders(ANA_EMAIL, ANA_PASSWORD);
    const otherDevice = await signInAndGetCookieHeaders(ANA_EMAIL, ANA_PASSWORD);
    const keptSessionId = await readSessionId(keptDevice);

    // Act
    await sessionRevoker.revokeAllForUserExcept(ana.id, keptSessionId);

    // Assert
    expect(await sessionReader.getCurrentSession(keptDevice)).toEqual({ userId: ana.id, sessionId: keptSessionId });
    expect(await sessionReader.getCurrentSession(otherDevice)).toBeNull();
  });

  it("revokeAllForUserExcept also removes sessions beyond Better Auth's 100-row list limit", async () => {
    // Arrange: one real session plus many extra rows inserted directly.
    const ana = await createUserWithPassword(ANA_EMAIL, ANA_PASSWORD);
    const keptDevice = await signInAndGetCookieHeaders(ANA_EMAIL, ANA_PASSWORD);
    const keptSessionId = await readSessionId(keptDevice);
    const expiresAt = new Date(Date.now() + ONE_DAY_MS);
    const extraSessions = Array.from({ length: MANY_SESSIONS_COUNT }, (_, index) => ({
      id: `extra-session-${index}`,
      token: `extra-token-${index}`,
      userId: ana.id,
      expiresAt,
      updatedAt: new Date(),
    }));
    await testDatabase.database.insert(sessionTable).values(extraSessions);

    // Act
    await sessionRevoker.revokeAllForUserExcept(ana.id, keptSessionId);

    // Assert
    expect(await countSessionRows(ana.id)).toBe(1);
    expect(await readSessionId(keptDevice)).toBe(keptSessionId);
  });
});

describe("BetterAuthPasswordHasher", () => {
  it("verifies a password against its own hash", async () => {
    // Arrange
    const hash = await passwordHasher.hash(ANA_PASSWORD);

    // Act + Assert
    expect(await passwordHasher.verify({ password: ANA_PASSWORD, hash })).toBe(true);
  });

  it("rejects a different password", async () => {
    // Arrange
    const hash = await passwordHasher.hash(ANA_PASSWORD);

    // Act + Assert
    expect(await passwordHasher.verify({ password: WRONG_PASSWORD, hash })).toBe(false);
  });

  it("never returns the plain password as the hash", async () => {
    // Act
    const hash = await passwordHasher.hash(ANA_PASSWORD);

    // Assert
    expect(hash).not.toBe(ANA_PASSWORD);
    expect(hash).not.toContain(ANA_PASSWORD);
  });
});
