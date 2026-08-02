import { describe } from "vitest";

import { findUserOrgIds } from "../../../src/socket/presence-repo";
import { db, VALID_ORG_ID, VALID_USER } from "../../helpers";
import { mockDb } from "../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../support/repo-contract";

describe("presence repo", () => {
  itDelegatesToPrisma([
    {
      name: "findUserOrgIds returns the caller's org ids",
      delegate: mockDb.membership.findMany,
      resolves: [{ orgId: VALID_ORG_ID }],
      call: () => findUserOrgIds(db, VALID_USER.id),
      args: { where: { userId: VALID_USER.id }, select: { orgId: true } },
      returns: [VALID_ORG_ID], // mapped from rows
    },
  ]);
});
