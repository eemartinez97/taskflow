import { describe, expect, it } from "vitest";

import {
  createOrgForUser,
  deleteOrgById,
  listMembers,
  listOrgs,
  removeMemberFromOrg,
  updateCursorPreference,
  updateMemberRoleInOrg,
  updateOrgById,
} from "../../../../src/modules/orgs/service";
import { buildMembership, buildOrg } from "../../../factories";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";

const org = buildOrg();

describe("read paths", () => {
  it("listOrgs returns the orgs the user belongs to", async () => {
    mockDb.org.findMany.mockResolvedValueOnce([org]);

    await expect(listOrgs(db, VALID_USER.id)).resolves.toEqual([org]);
  });

  it("listMembers returns the membership rows", async () => {
    mockDb.membership.findMany.mockResolvedValueOnce([buildMembership()]);

    await expect(listMembers(db, VALID_ORG_ID)).resolves.toHaveLength(1);
  });

  it("createOrgForUser delegates to the repo", async () => {
    mockDb.org.create.mockResolvedValueOnce(org);

    await expect(createOrgForUser(db, VALID_USER.id, { name: "Acme", slug: "acme" })).resolves.toBe(
      org,
    );
  });
});

describe("updateOrgById / deleteOrgById", () => {
  it.each([
    ["updateOrgById", () => updateOrgById(db, VALID_ORG_ID, { name: "New" })],
    ["deleteOrgById", () => deleteOrgById(db, VALID_ORG_ID)],
  ])("%s throws NOT_FOUND for a missing org", async (_name, call) => {
    mockDb.org.findUnique.mockResolvedValueOnce(null);

    await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateOrgById updates an existing org", async () => {
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.org.update.mockResolvedValueOnce({ ...org, name: "New" });

    await expect(updateOrgById(db, VALID_ORG_ID, { name: "New" })).resolves.toMatchObject({
      name: "New",
    });
  });

  it("deleteOrgById reports success", async () => {
    mockDb.org.findUnique.mockResolvedValueOnce(org);

    await expect(deleteOrgById(db, VALID_ORG_ID)).resolves.toEqual({ success: true });
    expect(mockDb.org.delete).toHaveBeenCalledOnce();
  });
});

describe("removeMemberFromOrg", () => {
  it("throws NOT_FOUND when there is no membership", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(null);

    await expect(removeMemberFromOrg(db, VALID_ORG_ID, ANOTHER_UUID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses to remove the OWNER", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "OWNER" }));

    await expect(removeMemberFromOrg(db, VALID_ORG_ID, ANOTHER_UUID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockDb.membership.delete).not.toHaveBeenCalled();
  });

  it("removes a non-owner member", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "MEMBER" }));

    await expect(removeMemberFromOrg(db, VALID_ORG_ID, ANOTHER_UUID)).resolves.toEqual({
      success: true,
    });
  });
});

describe("updateMemberRoleInOrg", () => {
  it("throws NOT_FOUND when there is no membership", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateMemberRoleInOrg(db, VALID_ORG_ID, ANOTHER_UUID, "ADMIN"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to change the OWNER's role", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "OWNER" }));

    await expect(
      updateMemberRoleInOrg(db, VALID_ORG_ID, ANOTHER_UUID, "ADMIN"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("promotes a MEMBER to ADMIN", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "MEMBER" }));
    mockDb.membership.update.mockResolvedValueOnce(buildMembership({ role: "ADMIN" }));

    await expect(
      updateMemberRoleInOrg(db, VALID_ORG_ID, ANOTHER_UUID, "ADMIN"),
    ).resolves.toMatchObject({ role: "ADMIN" });
  });
});

describe("updateCursorPreference", () => {
  it("delegates to the repo with the caller's own userId", async () => {
    mockDb.membership.update.mockResolvedValueOnce(buildMembership({ cursorsHidden: true }));

    await expect(
      updateCursorPreference(db, VALID_ORG_ID, VALID_USER.id, true),
    ).resolves.toMatchObject({ cursorsHidden: true });
    expect(mockDb.membership.update).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } },
      data: { cursorsHidden: true },
    });
  });
});
