import { describe, expect, it } from "vitest";
import { FakePasswordHasher } from "@/modules/users/application/testing/fake-password-hasher";
import { InMemoryCredentialRepository } from "@/modules/users/application/testing/in-memory-credential-repository";
import { InMemoryUserRepository } from "@/modules/users/application/testing/in-memory-user-repository";
import { makeLogOut } from "./log-out";
import { FakeAuthenticator } from "./testing/fake-authenticator";

describe("logOut", () => {
  it("asks the authenticator to sign out with the request headers", async () => {
    // Arrange
    const authenticator = new FakeAuthenticator({
      userRepository: new InMemoryUserRepository(),
      credentialRepository: new InMemoryCredentialRepository(),
      passwordHasher: new FakePasswordHasher(),
    });
    const logOut = makeLogOut({ authenticator });
    const requestHeaders = new Headers({ cookie: "session=abc" });

    // Act
    await logOut(requestHeaders);

    // Assert
    expect(authenticator.signOutCalls).toEqual([requestHeaders]);
    expect(authenticator.signOutCalls[0]).toBe(requestHeaders);
  });
});
