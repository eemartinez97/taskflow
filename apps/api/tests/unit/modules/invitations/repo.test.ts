import { beforeEach, describe, expect, it } from "vitest";

import {
  InvitationNotClaimableError,
  acceptInvitationTx,
  countPendingInvitations,
  declineInvitationTx,
  findInvitationById,
  findInvitationByTokenHash,
  findInvitationsForOrg,
  findPendingInvitationsForEmail,
  revokeInvitationIfPending,
  rotateInvitationToken,
  upsertInvitation,
} from "../../../../src/modules/invitations/repo";
import { invitationWithInviter, invitationWithOrg, mockDb } from "../../../mocks/database-mock";
import {
  buildInvitation,
  buildInvitationWithInviter,
  buildMembership,
  VALID_INVITATION_ID,
} from "../../../factories";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

const invitation = buildInvitation();
const invitationWithInviterRow = buildInvitationWithInviter();
const invitationWithOrgAndInviterRow = {
  ...invitation,
  org: { id: VALID_ORG_ID, name: "Acme" },
  invitedBy: { id: VALID_USER.id, name: VALID_USER.name, image: null },
};
const membership = buildMembership();

describe("invitations repo", () => {
  itDelegatesToPrisma([
    {
      name: "upsertInvitation",
      delegate: mockDb.invitation.upsert,
      resolves: invitation,
      call: () =>
        upsertInvitation(db, {
          orgId: VALID_ORG_ID,
          email: "bob@example.com",
          role: "MEMBER",
          tokenHash: "hash-1",
          expiresAt: invitation.expiresAt,
          invitedById: VALID_USER.id,
        }),
      args: {
        where: { orgId_email: { orgId: VALID_ORG_ID, email: "bob@example.com" } },
        create: {
          orgId: VALID_ORG_ID,
          email: "bob@example.com",
          role: "MEMBER",
          tokenHash: "hash-1",
          expiresAt: invitation.expiresAt,
          invitedById: VALID_USER.id,
        },
        update: {
          role: "MEMBER",
          tokenHash: "hash-1",
          expiresAt: invitation.expiresAt,
          status: "PENDING",
          invitedById: VALID_USER.id,
          respondedAt: null,
        },
      },
    },
    {
      name: "findInvitationById",
      delegate: mockDb.invitation.findUnique,
      resolves: invitation,
      call: () => findInvitationById(db, VALID_INVITATION_ID),
      args: { where: { id: VALID_INVITATION_ID } },
    },
    {
      name: "findInvitationByTokenHash",
      delegate: mockDb.invitation.findUnique,
      resolves: invitationWithOrgAndInviterRow,
      call: () => findInvitationByTokenHash(db, "hash-1"),
      args: {
        where: { tokenHash: "hash-1" },
        include: { ...invitationWithOrg, ...invitationWithInviter },
      },
    },
    {
      name: "findInvitationsForOrg",
      delegate: mockDb.invitation.findMany,
      resolves: [invitationWithInviterRow],
      call: () => findInvitationsForOrg(db, VALID_ORG_ID),
      args: {
        where: { orgId: VALID_ORG_ID },
        include: invitationWithInviter,
        orderBy: { createdAt: "desc" },
      },
    },
    {
      name: "countPendingInvitations",
      delegate: mockDb.invitation.count,
      resolves: 3,
      call: () => countPendingInvitations(db, VALID_ORG_ID),
      args: { where: { orgId: VALID_ORG_ID, status: "PENDING" } },
    },
    {
      name: "findPendingInvitationsForEmail",
      delegate: mockDb.invitation.findMany,
      resolves: [{ ...invitation, org: { name: "Acme" } }],
      call: () => findPendingInvitationsForEmail(db, "bob@example.com"),
      args: {
        where: {
          email: "bob@example.com",
          status: "PENDING",
          expiresAt: { gt: expect.any(Date) as Date },
        },
        include: { org: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    {
      name: "revokeInvitationIfPending",
      delegate: mockDb.invitation.updateMany,
      resolves: { count: 1 },
      call: () => revokeInvitationIfPending(db, VALID_INVITATION_ID),
      args: {
        where: { id: VALID_INVITATION_ID, status: "PENDING" },
        data: { status: "REVOKED" },
      },
    },
    {
      name: "rotateInvitationToken",
      delegate: mockDb.invitation.updateMany,
      resolves: { count: 1 },
      call: () => rotateInvitationToken(db, VALID_INVITATION_ID, "hash-2", invitation.expiresAt),
      args: {
        where: { id: VALID_INVITATION_ID, status: "PENDING" },
        data: { tokenHash: "hash-2", expiresAt: invitation.expiresAt },
      },
      returns: undefined,
    },
  ]);
});

describe("acceptInvitationTx / declineInvitationTx", () => {
  beforeEach(() => {
    // The default global $transaction mock only supports the array form
    // (Promise.all). accept/decline use the interactive callback form, so
    // route it straight back through mockDb - same delegates, same mocks.
    mockDb.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: typeof mockDb) => unknown)(mockDb)
        : Promise.all(arg as unknown[]),
    );
  });

  it("acceptInvitationTx creates a membership when the invitation is claimable", async () => {
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.membership.upsert.mockResolvedValueOnce(membership);

    await expect(
      acceptInvitationTx(db, VALID_INVITATION_ID, VALID_ORG_ID, ANOTHER_UUID, "MEMBER"),
    ).resolves.toBe(membership);

    expect(mockDb.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: VALID_INVITATION_ID,
        status: "PENDING",
        expiresAt: { gt: expect.any(Date) as Date },
      },
      data: { status: "ACCEPTED", respondedAt: expect.any(Date) as Date },
    });
    expect(mockDb.membership.upsert).toHaveBeenCalledWith({
      where: { orgId_userId: { orgId: VALID_ORG_ID, userId: ANOTHER_UUID } },
      create: { orgId: VALID_ORG_ID, userId: ANOTHER_UUID, role: "MEMBER" },
      update: {},
    });
  });

  it("acceptInvitationTx throws InvitationNotClaimableError when the update matches nothing", async () => {
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      acceptInvitationTx(db, VALID_INVITATION_ID, VALID_ORG_ID, ANOTHER_UUID, "MEMBER"),
    ).rejects.toBeInstanceOf(InvitationNotClaimableError);
    expect(mockDb.membership.upsert).not.toHaveBeenCalled();
  });

  it("declineInvitationTx marks the invitation declined when claimable", async () => {
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(declineInvitationTx(db, VALID_INVITATION_ID)).resolves.toBeUndefined();
    expect(mockDb.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: VALID_INVITATION_ID,
        status: "PENDING",
        expiresAt: { gt: expect.any(Date) as Date },
      },
      data: { status: "DECLINED", respondedAt: expect.any(Date) as Date },
    });
  });

  it("declineInvitationTx throws InvitationNotClaimableError when the update matches nothing", async () => {
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(declineInvitationTx(db, VALID_INVITATION_ID)).rejects.toBeInstanceOf(
      InvitationNotClaimableError,
    );
  });
});
