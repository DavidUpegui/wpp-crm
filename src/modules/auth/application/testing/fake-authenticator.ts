// TEST-ONLY fake. Never import this file from production code.

import type { Authenticator, SignInCredentials } from "@/modules/auth/domain/authenticator";
import { AccountDisabledError, InvalidCredentialsError } from "@/modules/auth/domain/errors";
import type { CredentialRepository } from "@/modules/users/domain/credential-repository";
import type { PasswordHasher } from "@/modules/users/domain/password-hasher";
import type { UserRepository } from "@/modules/users/domain/user-repository";

const SESSION_ID_PREFIX = "session-";

/** A session started by `FakeAuthenticator.signIn`, kept so tests can assert on it. */
export type FakeCreatedSession = {
  sessionId: string;
  userId: string;
};

/**
 * An `Authenticator` for tests that behaves like the real one (Better Auth +
 * our hook): the password is checked FIRST, and only when it is correct does
 * an inactive account raise `AccountDisabledError` (BR-003, AC-1.3).
 *
 * Users and passwords are set up with the users fakes
 * (`InMemoryUserRepository`, `InMemoryCredentialRepository`,
 * `FakePasswordHasher`), the same way as in every other test.
 */
export class FakeAuthenticator implements Authenticator {
  /** Sessions started by successful sign-ins, in call order. */
  public readonly createdSessions: FakeCreatedSession[] = [];

  /** Request headers passed to `signOut`, in call order. */
  public readonly signOutCalls: Headers[] = [];

  private readonly userRepository: UserRepository;
  private readonly credentialRepository: CredentialRepository;
  private readonly passwordHasher: PasswordHasher;
  private nextSessionNumber = 1;

  constructor(dependencies: {
    userRepository: UserRepository;
    credentialRepository: CredentialRepository;
    passwordHasher: PasswordHasher;
  }) {
    this.userRepository = dependencies.userRepository;
    this.credentialRepository = dependencies.credentialRepository;
    this.passwordHasher = dependencies.passwordHasher;
  }

  async signIn({ email, password }: SignInCredentials): Promise<{ userId: string }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordCorrect = await this.isPasswordCorrect(user.id, password);
    if (!isPasswordCorrect) {
      throw new InvalidCredentialsError();
    }

    // Checked only after the password, so a wrong password never reveals
    // that the account is disabled (BR-003).
    if (user.status === "inactive") {
      throw new AccountDisabledError();
    }

    this.createdSessions.push({ sessionId: this.generateSessionId(), userId: user.id });
    return { userId: user.id };
  }

  async signOut(requestHeaders: Headers): Promise<void> {
    this.signOutCalls.push(requestHeaders);
  }

  private async isPasswordCorrect(userId: string, password: string): Promise<boolean> {
    const passwordHash = await this.credentialRepository.getPasswordHash(userId);
    if (!passwordHash) {
      return false;
    }
    return this.passwordHasher.verify({ password, hash: passwordHash });
  }

  /** Readable, predictable ids: `session-1`, `session-2`, … */
  private generateSessionId(): string {
    const sessionId = SESSION_ID_PREFIX + this.nextSessionNumber;
    this.nextSessionNumber += 1;
    return sessionId;
  }
}
