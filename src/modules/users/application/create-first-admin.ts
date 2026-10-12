import { FirstAdminAlreadyExistsError } from "@/modules/users/domain/errors";
import { normalizeEmail } from "@/modules/users/domain/normalize-email";
import type { PasswordHasher } from "@/modules/users/domain/password-hasher";
import { assertPasswordMeetsPolicy } from "@/modules/users/domain/password-policy";
import type { User } from "@/modules/users/domain/user";
import type { UserTransactionRunner } from "@/modules/users/domain/user-transaction-runner";

/** What the operator types into the first-admin setup command (US-11). */
export type CreateFirstAdminInput = {
  name: string;
  email: string;
  /** Plain password; it is hashed here and never stored, returned or logged (AC-11.3). */
  password: string;
};

/** The interfaces `createFirstAdmin` needs; the container passes the real ones, tests pass fakes. */
export type CreateFirstAdminDependencies = {
  transactionRunner: UserTransactionRunner;
  passwordHasher: PasswordHasher;
};

/**
 * Builds the use case that creates the very first admin of the system
 * (FR-018, AC-11.1). The admin starts active with a temporary password, so
 * they must change it at first login.
 *
 * Refuses with `FirstAdminAlreadyExistsError` when any admin already exists,
 * active or inactive (BR-014, AC-11.2). The check and the writes run in one
 * transaction, so a refused or failed run changes nothing.
 */
export function makeCreateFirstAdmin(dependencies: CreateFirstAdminDependencies) {
  return async function createFirstAdmin(input: CreateFirstAdminInput): Promise<User> {
    assertPasswordMeetsPolicy(input.password);
    const passwordHash = await dependencies.passwordHasher.hash(input.password);

    return dependencies.transactionRunner.run(async ({ users, credentials }) => {
      const existingAdminCount = await users.countAdmins();
      if (existingAdminCount > 0) {
        throw new FirstAdminAlreadyExistsError();
      }

      const admin = await users.create({
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        role: "admin",
        mustChangePassword: true,
      });
      await credentials.createForUser(admin.id, passwordHash);
      return admin;
    });
  };
}
