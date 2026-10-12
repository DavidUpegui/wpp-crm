import type { Authenticator, SignInCredentials } from "@/modules/auth/domain/authenticator";
import { InvalidCredentialsError, TooManyLoginAttemptsError } from "@/modules/auth/domain/errors";
import { getFailedLoginWindowStart, isLoginBlocked } from "@/modules/auth/domain/login-attempt-policy";
import type { LoginAttemptKey, LoginAttemptRepository } from "@/modules/auth/domain/login-attempt-repository";
import { normalizeEmail } from "@/modules/users/domain/normalize-email";
import type { UserRepository } from "@/modules/users/domain/user-repository";

/** What the login form sends (US-1), plus where the request came from. */
export type LogInInput = {
  /** As typed by the user; it is normalized here (BR-001, AC-1.6). */
  email: string;
  /** Plain password; it is only passed to the authenticator and never stored, returned or logged. */
  password: string;
  /** Client IP address; failed attempts are counted per email + IP (BR-004). */
  ipAddress: string;
  /** Request headers the new session is tied to. */
  requestHeaders: Headers;
};

/** The interfaces `logIn` needs; the container passes the real ones, tests pass fakes. */
export type LogInDependencies = {
  loginAttemptRepository: LoginAttemptRepository;
  authenticator: Authenticator;
  userRepository: UserRepository;
  /** Current time; injected so the 15-minute window (BR-004) is testable. */
  now: () => Date;
};

/** What a successful login returns to the delivery layer. */
export type LogInResult = {
  userId: string;
  /** True when the password is temporary: the caller must redirect to the change-password screen (AC-1.4). */
  mustChangePassword: boolean;
};

/**
 * Builds the use case that logs a user in with email and password and starts
 * a session (FR-001, AC-1.1).
 *
 * The email is normalized first, so case and surrounding spaces do not matter
 * (BR-001, AC-1.6). After 5 failed attempts for the same email + IP in 15
 * minutes, further attempts fail with `TooManyLoginAttemptsError` (FR-003,
 * BR-004, AC-1.5). An unknown email and a wrong password both fail with the
 * same `InvalidCredentialsError` and count as a failed attempt (FR-002,
 * BR-003, AC-1.2). A correct password on a deactivated account fails with
 * `AccountDisabledError` and does NOT count as a failed attempt (AC-1.3).
 *
 * On success the failed attempts for this email + IP are cleared and the
 * last login date is saved (FR-004, AC-1.7).
 */
export function makeLogIn(dependencies: LogInDependencies) {
  const { loginAttemptRepository, authenticator, userRepository } = dependencies;

  return async function logIn(input: LogInInput): Promise<LogInResult> {
    const email = normalizeEmail(input.email);
    const attemptKey: LoginAttemptKey = { email, ipAddress: input.ipAddress };
    // Read the clock once, so the block check, the failure record and the
    // last login date all use the same moment.
    const now = dependencies.now();

    // Checked BEFORE the password: a blocked attempt is rejected even when
    // the password is correct (AC-1.5). Otherwise an attacker could keep
    // guessing and would learn the password the moment it is accepted.
    await assertLoginIsNotBlocked(attemptKey, now);

    const { userId } = await signInRecordingFailures(
      { email, password: input.password, requestHeaders: input.requestHeaders },
      attemptKey,
      now,
    );

    await loginAttemptRepository.clearFailures(attemptKey);
    await userRepository.recordLogin(userId, now);

    const mustChangePassword = await readMustChangePassword(userId);
    return { userId, mustChangePassword };
  };

  async function assertLoginIsNotBlocked(attemptKey: LoginAttemptKey, now: Date): Promise<void> {
    const recentFailures = await loginAttemptRepository.countRecentFailures(
      attemptKey,
      getFailedLoginWindowStart(now),
    );
    if (isLoginBlocked(recentFailures)) {
      throw new TooManyLoginAttemptsError();
    }
  }

  async function signInRecordingFailures(
    credentials: SignInCredentials,
    attemptKey: LoginAttemptKey,
    attemptedAt: Date,
  ): Promise<{ userId: string }> {
    try {
      return await authenticator.signIn(credentials);
    } catch (error) {
      // Only a wrong password or unknown email is a guessing attempt. Any
      // other error (including `AccountDisabledError`, which is raised only
      // after the password was verified as correct, AC-1.3) is rethrown
      // WITHOUT recording a failure.
      if (error instanceof InvalidCredentialsError) {
        await loginAttemptRepository.recordFailure(attemptKey, attemptedAt);
      }
      throw error;
    }
  }

  async function readMustChangePassword(userId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);
    if (!user) {
      // Should never happen: the authenticator just signed this user in.
      // Fail with the generic error rather than reveal anything (BR-003).
      throw new InvalidCredentialsError();
    }
    return user.mustChangePassword;
  }
}
