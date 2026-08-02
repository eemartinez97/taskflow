import { describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";

import {
  createOrgForUser,
  deleteOrgById,
  inviteMemberToOrg,
  listMembers,
  listOrgs,
  removeMemberFromOrg,
  updateMemberRoleInOrg,
  updateOrgById,
} from "../../../../src/modules/orgs/service";
import { buildMembership, buildOrg } from "../../../factories";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import { expectEmittedToUser } from "../../../support/socket-assert";

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

describe("inviteMemberToOrg", () => {
  const data = { email: "bob@example.com", role: "MEMBER" as const };
  const membership = buildMembership({ userId: ANOTHER_UUID });

  it("creates the membership and notifies the invitee", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce({ id: ANOTHER_UUID }) // repo.inviteMember lookup
      .mockResolvedValueOnce({ name: "Alice" }); // getActorName
    mockDb.membership.create.mockResolvedValueOnce(membership);
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await expect(inviteMemberToOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id, data)).resolves.toBe(
      membership,
    );

    expectEmittedToUser(ANOTHER_UUID, SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: { id: "n1" },
    });
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "MEMBER_INVITED",
          message: 'Alice invited you to "Acme"',
          entityType: "org",
        }) as unknown,
      }),
    );
  });

  it("falls back to an empty org name when the org vanished", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce({ id: ANOTHER_UUID })
      .mockResolvedValueOnce({ name: "Alice" });
    mockDb.membership.create.mockResolvedValueOnce(membership);
    mockDb.org.findUnique.mockResolvedValueOnce(null);
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await inviteMemberToOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id, data);

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: "Alice invited you to an organization",
        }) as unknown,
      }),
    );
  });

  it("maps UserNotFoundError to a helpful NOT_FOUND", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      inviteMemberToOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id, data),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: expect.stringContaining("bob@example.com") as unknown,
    });
  });

  it("re-throws unknown errors (e.g. unique constraint)", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: ANOTHER_UUID });
    mockDb.membership.create.mockRejectedValueOnce(new Error("P2002"));

    await expect(inviteMemberToOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id, data)).rejects.toThrow(
      "P2002",
    );
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
