import { describe, expect, it } from "vitest";
import { buildUser } from "@/modules/users/application/testing/build-user";
import { InMemoryUserRepository } from "@/modules/users/application/testing/in-memory-user-repository";
import type { User } from "@/modules/users/domain/user";
import { makeGetCurrentUser } from "./get-current-user";
import { FakeSessionReader } from "./testing/fake-session-reader";

const USER_ID = "ana";
const SESSION_ID = "session-1";

function setUp() {
  const sessionReader = new FakeSessionReader();
  const users = new InMemoryUserRepository();
  const getCurrentUser = makeGetCurrentUser({ sessionReader, userRepository: users });
  return { sessionReader, users, getCurrentUser };
}

/** Seeds a user and gives the request a session for them. */
function logInAs(
  { sessionReader, users }: ReturnType<typeof setUp>,
  userOverrides: Partial<User> = {},
): void {
  users.seed(buildUser({ id: USER_ID, ...userOverrides }));
  sessionReader.setCurrentSession({ userId: USER_ID, sessionId: SESSION_ID });
}

describe("getCurrentUser", () => {
  it("returns null when the request has no session", async () => {
    // Arrange
    const { getCurrentUser } = setUp();

    // Act
    const currentUser = await getCurrentUser(new Headers());

    // Assert
    expect(currentUser).toBeNull();
  });

  it("returns null when the session's user no longer exists", async () => {
    // Arrange
    const { sessionReader, getCurrentUser } = setUp();
    sessionReader.setCurrentSession({ userId: "missing-user", sessionId: SESSION_ID });

    // Act
    const currentUser = await getCurrentUser(new Headers());

    // Assert
    expect(currentUser).toBeNull();
  });

  it("returns null for an inactive user even if their session survived", async () => {
    // Arrange
    const context = setUp();
    logInAs(context, { status: "inactive" });

    // Act
    const currentUser = await context.getCurrentUser(new Headers());

    // Assert
    expect(currentUser).toBeNull();
  });

  it("returns the active user together with the session id", async () => {
    // Arrange
    const context = setUp();
    logInAs(context, {
      name: "Ana",
      email: "ana@example.com",
      role: "admin",
      mustChangePassword: true,
    });

    // Act
    const currentUser = await context.getCurrentUser(new Headers());

    // Assert
    expect(currentUser).toEqual({
      id: USER_ID,
      name: "Ana",
      email: "ana@example.com",
      role: "admin",
      mustChangePassword: true,
      sessionId: SESSION_ID,
    });
  });

  it("reads the role fresh from the repository on every call", async () => {
    // Arrange
    const context = setUp();
    logInAs(context, { name: "Ana", role: "admin" });
    const firstCall = await context.getCurrentUser(new Headers());

    // Act
    await context.users.updateNameAndRole(USER_ID, { name: "Ana", role: "agent" });
    const secondCall = await context.getCurrentUser(new Headers());

    // Assert
    expect(firstCall?.role).toBe("admin");
    expect(secondCall?.role).toBe("agent");
  });
});
