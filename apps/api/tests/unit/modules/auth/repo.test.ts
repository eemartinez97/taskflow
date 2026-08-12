import { describe } from "vitest";

import {
  createUnverifiedUser,
  deleteUserSessions,
  findUserById,
  findUserForActivationNotice,
  findUserByEmail,
  updateUser,
} from "../../../../src/modules/auth/repo";
import { db, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

const select = { id: true, email: true, name: true, image: true };
const user = { ...VALID_USER, image: null };

describe("auth repo", () => {
  itDelegatesToPrisma([
    {
      name: "findUserById",
      delegate: mockDb.user.findUnique,
      resolves: user,
      call: () => findUserById(db, VALID_USER.id),
      args: { where: { id: VALID_USER.id }, select },
    },
    {
      name: "deleteUserSessions",
      delegate: mockDb.session.deleteMany,
      resolves: { count: 2 },
      call: () => deleteUserSessions(db, VALID_USER.id),
      args: { where: { userId: VALID_USER.id } },
      returns: undefined, // returns void by design
    },
    {
      name: "updateUser strips undefined before hitting Prisma",
      delegate: mockDb.user.update,
      resolves: user,
      call: () => updateUser(db, VALID_USER.id, { name: "Bob", image: undefined }),
      args: { where: { id: VALID_USER.id }, data: { name: "Bob" }, select },
    },
    {
      name: "findUserByEmail",
      delegate: mockDb.user.findUnique,
      resolves: { id: VALID_USER.id, name: "Bob", emailVerified: null },
      call: () => findUserByEmail(db, "bob@example.com"),
      args: {
        where: { email: "bob@example.com" },
        select: { id: true, name: true, emailVerified: true },
      },
    },
    {
      name: "createUnverifiedUser",
      delegate: mockDb.user.create,
      resolves: { id: VALID_USER.id, name: "Bob" },
      call: () =>
        createUnverifiedUser(db, {
          name: "Bob",
          email: "bob@example.com",
          hashedPassword: "hashed:pw",
        }),
      args: {
        data: { name: "Bob", email: "bob@example.com", password: "hashed:pw" },
        select: { id: true, name: true },
      },
    },
    {
      name: "findUserForActivationNotice",
      delegate: mockDb.user.findUnique,
      resolves: { email: "bob@example.com", name: "Bob" },
      call: () => findUserForActivationNotice(db, VALID_USER.id),
      args: { where: { id: VALID_USER.id }, select: { email: true, name: true } },
    },
  ]);
});
