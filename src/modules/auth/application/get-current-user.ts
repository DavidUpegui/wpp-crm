import type { CurrentUser } from "@/modules/auth/domain/current-user";
import type { ActiveSession, SessionReader } from "@/modules/auth/domain/session-reader";
import type { User } from "@/modules/users/domain/user";
import type { UserRepository } from "@/modules/users/domain/user-repository";

/** The interfaces `getCurrentUser` needs; the container passes the real ones, tests pass fakes. */
export type GetCurrentUserDependencies = {
  sessionReader: SessionReader;
  userRepository: UserRepository;
};

/**
 * The shape of the `getCurrentUser` use case. Exported so `requireCurrentUser`
 * can depend on the function itself instead of on its dependencies.
 */
export type GetCurrentUser = (requestHeaders: Headers) => Promise<CurrentUser | null>;

/**
 * Builds the use case that returns the logged-in, ACTIVE user of a request,
 * or `null` when there is none (FR-006).
 *
 * The user is read FRESH from the database on every call — never cache it —
 * so a role or status change applies on the user's next request (BR-007).
 * An inactive user gets `null` even if one of their sessions survived
 * deactivation (BR-006, belt-and-braces).
 */
export function makeGetCurrentUser(dependencies: GetCurrentUserDependencies): GetCurrentUser {
  const { sessionReader, userRepository } = dependencies;

  return async function getCurrentUser(requestHeaders: Headers): Promise<CurrentUser | null> {
    const session = await sessionReader.getCurrentSession(requestHeaders);
    if (!session) {
      return null;
    }

    const user = await userRepository.findById(session.userId);
    if (!user) {
      return null;
    }

    if (user.status === "inactive") {
      return null;
    }

    return toCurrentUser(user, session);
  };
}

function toCurrentUser(user: User, session: ActiveSession): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    sessionId: session.sessionId,
  };
}
