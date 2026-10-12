import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { buildUser } from "@/modules/users/application/testing/build-user";
import { InMemoryUserRepository } from "@/modules/users/application/testing/in-memory-user-repository";
import { EmptyNameError } from "@/modules/users/domain/errors";

import { makeUpdateOwnName } from "./update-own-name";

const USER_ID = "ana-agent";
const OLD_NAME = "Ana Agent";

/** Seeds one user and builds the use case plus a matching `CurrentUser`. */
function setUp() {
  const userRecord = buildUser({ id: USER_ID, name: OLD_NAME, email: "ana@example.com" });
  const userRepository = new InMemoryUserRepository();
  userRepository.seed(userRecord);

  const currentUser: CurrentUser = {
    id: USER_ID,
    name: userRecord.name,
    email: userRecord.email,
    role: userRecord.role,
    mustChangePassword: false,
    sessionId: "session-current",
  };

  const updateOwnName = makeUpdateOwnName({ userRepository });
  return { userRepository, currentUser, updateOwnName };
}

describe("updateOwnName", () => {
  it("saves the new name", async () => {
    // Arrange
    const { userRepository, currentUser, updateOwnName } = setUp();

    // Act
    await updateOwnName({ currentUser, name: "Ana María" });

    // Assert
    expect((await userRepository.findById(USER_ID))?.name).toBe("Ana María");
  });

  it("trims spaces around the name", async () => {
    // Arrange
    const { userRepository, currentUser, updateOwnName } = setUp();

    // Act
    await updateOwnName({ currentUser, name: "   Ana María  " });

    // Assert
    expect((await userRepository.findById(USER_ID))?.name).toBe("Ana María");
  });

  it("rejects a name made only of spaces and keeps the old name", async () => {
    // Arrange
    const { userRepository, currentUser, updateOwnName } = setUp();

    // Act
    const update = updateOwnName({ currentUser, name: "    " });

    // Assert
    await expect(update).rejects.toThrow(EmptyNameError);
    expect((await userRepository.findById(USER_ID))?.name).toBe(OLD_NAME);
  });

  it("rejects an empty name", async () => {
    // Arrange
    const { currentUser, updateOwnName } = setUp();

    // Act
    const update = updateOwnName({ currentUser, name: "" });

    // Assert
    await expect(update).rejects.toThrow(EmptyNameError);
  });
});
