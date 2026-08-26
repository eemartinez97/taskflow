import { describe } from "vitest";

import {
  createOrg,
  deleteOrg,
  findMembers,
  findMembership,
  findOrgById,
  findOrgsByUser,
  removeMember,
  updateMembershipCursorPref,
  updateMembershipRole,
  updateOrg,
} from "../../../../src/modules/orgs/repo";
import { membershipWithUser, orgWithMembership } from "../../../mocks/database-mock";
import { buildMembership, buildOrg } from "../../../factories";
import { db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

const org = buildOrg();
const membership = buildMembership();

describe("orgs repo", () => {
  itDelegatesToPrisma([
    {
      name: "findOrgsByUser scopes memberships to the caller",
      delegate: mockDb.org.findMany,
      resolves: [org],
      call: () => findOrgsByUser(db, VALID_USER.id),
      args: {
        where: { memberships: { some: { userId: VALID_USER.id } } },
        include: {
          memberships: { ...orgWithMembership.memberships, where: { userId: VALID_USER.id } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    {
      name: "findOrgById",
      delegate: mockDb.org.findUnique,
      resolves: org,
      call: () => findOrgById(db, VALID_ORG_ID),
      args: { where: { id: VALID_ORG_ID } },
    },
    {
      name: "createOrg makes the creator OWNER",
      delegate: mockDb.org.create,
      resolves: org,
      call: () => createOrg(db, VALID_USER.id, { name: "Acme", slug: "acme" }),
      args: {
        data: {
          name: "Acme",
          slug: "acme",
          memberships: { create: { userId: VALID_USER.id, role: "OWNER" } },
        },
      },
    },
    {
      name: "updateOrg strips undefined",
      delegate: mockDb.org.update,
      resolves: org,
      call: () => updateOrg(db, VALID_ORG_ID, { name: "New", slug: undefined }),
      args: { where: { id: VALID_ORG_ID }, data: { name: "New" } },
    },
    {
      name: "deleteOrg",
      delegate: mockDb.org.delete,
      resolves: org,
      call: () => deleteOrg(db, VALID_ORG_ID),
      args: { where: { id: VALID_ORG_ID } },
      returns: undefined,
    },
    {
      name: "findMembers",
      delegate: mockDb.membership.findMany,
      resolves: [membership],
      call: () => findMembers(db, VALID_ORG_ID),
      args: {
        where: { orgId: VALID_ORG_ID },
        include: membershipWithUser,
        orderBy: { createdAt: "asc" },
      },
    },
    {
      name: "removeMember uses the composite key",
      delegate: mockDb.membership.delete,
      resolves: membership,
      call: () => removeMember(db, VALID_ORG_ID, VALID_USER.id),
      args: { where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } } },
      returns: undefined,
    },
    {
      name: "findMembership",
      delegate: mockDb.membership.findUnique,
      resolves: membership,
      call: () => findMembership(db, VALID_ORG_ID, VALID_USER.id),
      args: { where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } } },
    },
    {
      name: "updateMembershipRole",
      delegate: mockDb.membership.update,
      resolves: membership,
      call: () => updateMembershipRole(db, VALID_ORG_ID, VALID_USER.id, "ADMIN"),
      args: {
        where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } },
        data: { role: "ADMIN" },
      },
    },
    {
      name: "updateMembershipCursorPref",
      delegate: mockDb.membership.update,
      resolves: membership,
      call: () => updateMembershipCursorPref(db, VALID_ORG_ID, VALID_USER.id, true),
      args: {
        where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } },
        data: { cursorsHidden: true },
      },
    },
  ]);
});
