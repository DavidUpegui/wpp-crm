import type { Actor } from "@/modules/users/domain/actor";
import { normalizeEmail } from "@/modules/users/domain/normalize-email";
import type { PasswordHasher } from "@/modules/users/domain/password-hasher";
import { assertPasswordMeetsPolicy } from "@/modules/users/domain/password-policy";
import { assertIsAdmin } from "@/modules/users/domain/permissions";
import type { User, UserRole } from "@/modules/users/domain/user";
import type { UserTransactionRunner } from "@/modules/users/domain/user-transaction-runner";

/** What the admin fills in on the "create user" form (US-7). */
export type CreateUserInput = {
  /** The logged-in user creating the account; must be an admin (BR-012). */
  actor: Actor;
  name: string;
  email: string;
  role: UserRole;
  /** Plain temporary password; it is hashed here and never stored, returned or logged. */
  temporaryPassword: string;
};

/** The interfaces `createUser` needs; the container passes the real ones, tests pass fakes. */
export type CreateUserDependencies = {
  transactionRunner: UserTransactionRunner;
  passwordHasher: PasswordHasher;
};

/**
 * Builds the use case that lets an admin create a new user (FR-014, AC-7.1).
 * The new user starts active with a temporary password, so they must change
 * it at first login (AC-7.5).
 *
 * Checks run cheapest first: the actor must be an admin (BR-012, otherwise
 * `ForbiddenError`), then the temporary password must meet the policy
 * (BR-002, AC-7.3, otherwise `PasswordPolicyError`). Only then is the
 * password hashed.
 *
 * The email is stored normalized; an email already used by another user,
 * ignoring case, fails with `EmailAlreadyInUseError` (BR-001, AC-7.2). The
 * same unique email rule makes a double submit safe: the second identical
 * request fails with `EmailAlreadyInUseError`, so only one user is created
 * (AC-7.4). The user and credential rows are written in one transaction, so
 * a failed run creates nothing.
 */
export function makeCreateUser(dependencies: CreateUserDependencies) {
  return async function createUser(input: CreateUserInput): Promise<User> {
    assertIsAdmin(input.actor);
    assertPasswordMeetsPolicy(input.temporaryPassword);
    const passwordHash = await dependencies.passwordHasher.hash(input.temporaryPassword);

    return dependencies.transactionRunner.run(async ({ users, credentials }) => {
      const user = await users.create({
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        role: input.role,
        mustChangePassword: true,
      });
      await credentials.createForUser(user.id, passwordHash);
      return user;
    });
  };
}
