import { beforeEach, describe, expect, it } from "vitest";

import {
  createOrgForUser,
  deleteOrgById,
  leaveOrg,
  listAssigneeLookup,
  listFormerAssignees,
  listMembers,
  listOrgs,
  removeMemberFromOrg,
  updateCursorPreference,
  updateMemberRoleInOrg,
  updateOrgById,
} from "../../../../src/modules/orgs/service";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { appCollectors } from "../../../../src/metrics";
import { buildMembership, buildNotificationWithActor, buildOrg } from "../../../factories";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import { expectEmittedToUser } from "../../../support/socket-assert";

const org = buildOrg();

beforeEach(() => {
  appCollectors.orgsCreatedTotal.reset();
  appCollectors.orgMembersRemovedTotal.reset();
});

/** Satisfies removeMembershipAndNotify's Promise.all - org/task-count/admin lookups. */
function mockDepartureLookups(): void {
  mockDb.org.findUnique.mockResolvedValueOnce(org);
  mockDb.task.count.mockResolvedValueOnce(0);
  mockDb.membership.findMany.mockResolvedValueOnce([]);
}

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
    expect((await appCollectors.orgsCreatedTotal.get()).values[0]?.value).toBe(1);
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

    await expect(
      removeMemberFromOrg(db, mockIo, VALID_ORG_ID, ANOTHER_UUID, VALID_USER.id),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses to remove the OWNER", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "OWNER" }));

    await expect(
      removeMemberFromOrg(db, mockIo, VALID_ORG_ID, ANOTHER_UUID, VALID_USER.id),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockDb.membership.delete).not.toHaveBeenCalled();
  });

  it("removes a non-owner member and notifies OWNER/ADMIN", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "MEMBER" }));
    mockDepartureLookups();

    await expect(
      removeMemberFromOrg(db, mockIo, VALID_ORG_ID, ANOTHER_UUID, VALID_USER.id),
    ).resolves.toEqual({
      success: true,
    });
    expect(mockDb.membership.delete).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: VALID_ORG_ID, userId: ANOTHER_UUID } },
    });
    expect((await appCollectors.orgMembersRemovedTotal.get()).values).toEqual([
      expect.objectContaining({ labels: { reason: "removed" }, value: 1 }),
    ]);
  });

  it("also notifies the removed member themselves, with a distinct message from a voluntary leave", async () => {
    const notification = buildNotificationWithActor();
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "MEMBER" }));
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.task.count.mockResolvedValueOnce(0);
    mockDb.membership.findMany.mockResolvedValueOnce([{ userId: VALID_USER.id }]);
    // getActorName is called once for the actor (the OWNER doing the
    // removing) and once for the removed member (ANOTHER_UUID) - the
    // forced-removal message needs both names.
    mockDb.user.findUnique
      .mockResolvedValueOnce({ name: "Owner Alice" })
      .mockResolvedValueOnce({ name: "Bob" });
    mockDb.notification.create.mockResolvedValue(notification);

    await removeMemberFromOrg(db, mockIo, VALID_ORG_ID, ANOTHER_UUID, VALID_USER.id);
    // Fire-and-forget - let its microtasks settle before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ANOTHER_UUID,
          actorId: VALID_USER.id,
          message: 'Owner Alice removed Bob from "Acme"',
        }) as unknown,
      }),
    );
  });
});

describe("leaveOrg", () => {
  it("throws NOT_FOUND when there is no membership", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(null);

    await expect(leaveOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses to let the OWNER leave", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "OWNER" }));

    await expect(leaveOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockDb.membership.delete).not.toHaveBeenCalled();
  });

  it("lets a non-owner leave and notifies OWNER/ADMIN", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "MEMBER" }));
    mockDepartureLookups();

    await expect(leaveOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id)).resolves.toEqual({
      success: true,
    });
    expect(mockDb.membership.delete).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: VALID_ORG_ID, userId: VALID_USER.id } },
    });
    expect((await appCollectors.orgMembersRemovedTotal.get()).values).toEqual([
      expect.objectContaining({ labels: { reason: "left" }, value: 1 }),
    ]);
  });

  it("notifies a remaining OWNER/ADMIN when there are stranded tasks", async () => {
    const notification = buildNotificationWithActor();
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "MEMBER" }));
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.task.count.mockResolvedValueOnce(3);
    mockDb.membership.findMany.mockResolvedValueOnce([{ userId: ANOTHER_UUID }]);
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await leaveOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id);
    // The notification is fire-and-forget (see removeMembershipAndNotify) -
    // it starts after leaveOrg's own promise already resolved, so let its
    // microtasks settle before asserting on it.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ANOTHER_UUID,
          actorId: VALID_USER.id,
          type: "MEMBER_LEFT",
          message: expect.stringContaining("3 tasks need reassignment") as string,
        }) as unknown,
      }),
    );
    expectEmittedToUser(ANOTHER_UUID, SOCKET_EVENTS.NOTIFICATION_CREATED, { notification });
  });

  it("falls back to an empty org name if the org lookup somehow returns null", async () => {
    const notification = buildNotificationWithActor();
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ role: "MEMBER" }));
    mockDb.org.findUnique.mockResolvedValueOnce(null);
    mockDb.task.count.mockResolvedValueOnce(0);
    mockDb.membership.findMany.mockResolvedValueOnce([{ userId: ANOTHER_UUID }]);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce(notification);

    await leaveOrg(db, mockIo, VALID_ORG_ID, VALID_USER.id);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: "Alice left the organization" }) as unknown,
      }),
    );
  });
});

describe("listFormerAssignees", () => {
  it("delegates to the repo", async () => {
    mockDb.user.findMany.mockResolvedValueOnce([{ id: ANOTHER_UUID, name: "Bob" }]);

    await expect(listFormerAssignees(db, VALID_ORG_ID)).resolves.toEqual([
      { id: ANOTHER_UUID, name: "Bob" },
    ]);
  });
});

describe("listAssigneeLookup", () => {
  it("combines members and formerAssignees into one result", async () => {
    const member = buildMembership();
    mockDb.membership.findMany.mockResolvedValueOnce([member]);
    mockDb.user.findMany.mockResolvedValueOnce([{ id: ANOTHER_UUID, name: "Bob" }]);

    await expect(listAssigneeLookup(db, VALID_ORG_ID)).resolves.toEqual({
      members: [member],
      formerAssignees: [{ id: ANOTHER_UUID, name: "Bob" }],
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
