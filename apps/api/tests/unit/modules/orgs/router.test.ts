import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOrgsRouter } from "../../../../src/modules/orgs/router";
import * as service from "../../../../src/modules/orgs/service";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { mockIo } from "../../../mocks/socket";
import { callerFor, expectTRPCError, grantRole } from "../../../support/trpc";

vi.mock("../../../../src/modules/orgs/service");

const router = createOrgsRouter(mockIo);
const caller = () => callerFor(router);

describe("orgs router", () => {
  beforeEach(() => {
    grantRole("OWNER");
  });

  it("list -> listOrgs", async () => {
    await caller().list();

    expect(service.listOrgs).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("create -> createOrgForUser", async () => {
    await caller().create({ name: "Acme", slug: "acme" });

    expect(service.createOrgForUser).toHaveBeenCalledWith(db, VALID_USER.id, {
      name: "Acme",
      slug: "acme",
    });
  });

  it("update -> updateOrgById", async () => {
    await caller().update({ orgId: VALID_ORG_ID, data: { name: "New" } });

    expect(service.updateOrgById).toHaveBeenCalledWith(db, VALID_ORG_ID, { name: "New" });
  });

  it("delete -> deleteOrgById", async () => {
    await caller().delete({ orgId: VALID_ORG_ID });

    expect(service.deleteOrgById).toHaveBeenCalledWith(db, VALID_ORG_ID);
  });

  it("members -> listMembers", async () => {
    await caller().members({ orgId: VALID_ORG_ID });

    expect(service.listMembers).toHaveBeenCalledWith(db, VALID_ORG_ID);
  });

  it("invite -> inviteMemberToOrg with io injected", async () => {
    const data = { email: "bob@example.com", role: "MEMBER" as const };

    await caller().invite({ orgId: VALID_ORG_ID, data });

    expect(service.inviteMemberToOrg).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_ORG_ID,
      VALID_USER.id,
      data,
    );
  });

  it("removeMember -> removeMemberFromOrg", async () => {
    await caller().removeMember({ orgId: VALID_ORG_ID, userId: ANOTHER_UUID });

    expect(service.removeMemberFromOrg).toHaveBeenCalledWith(db, VALID_ORG_ID, ANOTHER_UUID);
  });

  it("updateMemberRole unwraps data.role", async () => {
    await caller().updateMemberRole({
      orgId: VALID_ORG_ID,
      userId: ANOTHER_UUID,
      data: { role: "ADMIN" },
    });

    expect(service.updateMemberRoleInOrg).toHaveBeenCalledWith(
      db,
      VALID_ORG_ID,
      ANOTHER_UUID,
      "ADMIN",
    );
  });
});

describe("orgs router RBAC", () => {
  it.each([
    ["delete", () => caller().delete({ orgId: VALID_ORG_ID })],
    ["removeMember", () => caller().removeMember({ orgId: VALID_ORG_ID, userId: ANOTHER_UUID })],
    [
      "updateMemberRole",
      () =>
        caller().updateMemberRole({
          orgId: VALID_ORG_ID,
          userId: ANOTHER_UUID,
          data: { role: "ADMIN" },
        }),
    ],
  ])("%s is OWNER-only", async (_name, call) => {
    grantRole("ADMIN");

    await expectTRPCError(call(), "FORBIDDEN");
  });

  it.each([
    ["update", () => caller().update({ orgId: VALID_ORG_ID, data: { name: "x" } })],
    [
      "invite",
      () =>
        caller().invite({
          orgId: VALID_ORG_ID,
          data: { email: "b@example.com", role: "MEMBER" as const },
        }),
    ],
  ])("%s requires OWNER or ADMIN", async (_name, call) => {
    grantRole("MEMBER");

    await expectTRPCError(call(), "FORBIDDEN");
  });

  it("list requires a session", async () => {
    await expectTRPCError(callerFor(router, null).list(), "UNAUTHORIZED");
  });
});
