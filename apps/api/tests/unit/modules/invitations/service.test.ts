import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendOrgInviteEmail, type EmailSender } from "@taskflow/mail";
import type * as TaskflowMail from "@taskflow/mail";
import { MAX_PENDING_INVITATIONS_PER_ORG, SOCKET_EVENTS } from "@taskflow/shared";

import {
  acceptInvitation,
  assertInvitationRecipient,
  claimInvitationsForUser,
  createInvitation,
  declineInvitation,
  getInvitationPreviewByToken,
  getInvitationPublicPreviewByToken,
  listInvitationsForOrg,
  listMyInvitations,
  resendInvitation,
  revokeInvitation,
} from "../../../../src/modules/invitations/service";
import { generateRawToken, hashToken } from "../../../../src/modules/auth/tokens";
import { getEmailSender } from "../../../../src/mail/sender";
import {
  buildInvitation,
  buildInvitationWithInviter,
  buildMembership,
  VALID_INVITATION_ID,
} from "../../../factories";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import {
  expectEmittedToOrg,
  expectEmittedToUser,
  expectNoEmit,
} from "../../../support/socket-assert";

vi.mock("../../../../src/modules/auth/tokens");
vi.mock("../../../../src/mail/sender");
vi.mock("@taskflow/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof TaskflowMail>();
  return { ...actual, sendOrgInviteEmail: vi.fn() };
});

const mockGenerateRawToken = vi.mocked(generateRawToken);
const mockHashToken = vi.mocked(hashToken);
const mockGetEmailSender = vi.mocked(getEmailSender);
const mockSendOrgInviteEmail = vi.mocked(sendOrgInviteEmail);
const FAKE_SENDER = {} as EmailSender;

const RAW_TOKEN = "raw-invite-token";
const TOKEN_HASH = "hashed-invite-token";
const INVITEE_EMAIL = "bob@example.com";

const org = {
  id: VALID_ORG_ID,
  name: "Acme",
  slug: "acme",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  mockGenerateRawToken.mockReturnValue(RAW_TOKEN);
  mockHashToken.mockReturnValue(TOKEN_HASH);
  mockGetEmailSender.mockReturnValue(FAKE_SENDER);
  mockSendOrgInviteEmail.mockResolvedValue(undefined);
});

describe("assertInvitationRecipient", () => {
  it("passes for a case-insensitive email match", () => {
    expect(() => {
      assertInvitationRecipient("Bob@Example.com", "bob@example.com");
    }).not.toThrow();
  });

  it("throws FORBIDDEN for a mismatched email", () => {
    expect(() => {
      assertInvitationRecipient("someone-else@example.com", "bob@example.com");
    }).toThrow(expect.objectContaining({ code: "FORBIDDEN" }) as Error);
  });
});

describe("createInvitation", () => {
  const data = { email: INVITEE_EMAIL, role: "MEMBER" as const };

  it("rejects a self-invite without touching the database", async () => {
    await expect(
      createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, INVITEE_EMAIL, data),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a self-invite case-insensitively", async () => {
    await expect(
      createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, "Bob@Example.com", data),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws CONFLICT when the invitee already has a membership", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: ANOTHER_UUID, emailVerified: new Date() });
    mockDb.membership.findUnique.mockResolvedValueOnce(buildMembership({ userId: ANOTHER_UUID }));

    await expect(
      createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mockDb.invitation.upsert).not.toHaveBeenCalled();
  });

  it("throws TOO_MANY_REQUESTS when the org is at its pending-invitation cap", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);
    mockDb.invitation.count.mockResolvedValueOnce(MAX_PENDING_INVITATIONS_PER_ORG);

    await expect(
      createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mockDb.invitation.upsert).not.toHaveBeenCalled();
  });

  it("invites a brand-new email with a /register?invite= link and no notification", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null); // findUserByEmail
    mockDb.invitation.count.mockResolvedValueOnce(0);
    mockDb.invitation.upsert.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" }); // getActorName

    await expect(
      createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data),
    ).resolves.toEqual({ success: true });

    expect(mockDb.invitation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tokenHash: TOKEN_HASH }) as unknown,
      }),
    );
    expect(mockSendOrgInviteEmail).toHaveBeenCalledWith(FAKE_SENDER, {
      to: INVITEE_EMAIL,
      orgName: "Acme",
      inviterName: "Alice",
      role: "MEMBER",
      acceptUrl: expect.stringContaining(`/register?invite=${RAW_TOKEN}`) as string,
      expiresInHours: expect.any(Number) as number,
      isNewUser: true,
    });
    expectNoEmit();
  });

  it("invites an existing verified user with an /invitations link and notifies them", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: ANOTHER_UUID,
      emailVerified: new Date(),
    });
    mockDb.membership.findUnique.mockResolvedValueOnce(null);
    mockDb.invitation.count.mockResolvedValueOnce(0);
    const invitation = buildInvitation({ email: INVITEE_EMAIL });
    mockDb.invitation.upsert.mockResolvedValueOnce(invitation);
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" }); // getActorName
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data);

    expect(mockSendOrgInviteEmail).toHaveBeenCalledWith(
      FAKE_SENDER,
      expect.objectContaining({
        acceptUrl: expect.stringContaining(`/invitations/${RAW_TOKEN}`) as string,
        isNewUser: false,
      }),
    );
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "MEMBER_INVITED", userId: ANOTHER_UUID }) as unknown,
      }),
    );
    expectEmittedToUser(ANOTHER_UUID, SOCKET_EVENTS.INVITATION_RECEIVED, {
      invitation: {
        id: invitation.id,
        orgId: invitation.orgId,
        orgName: "Acme",
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  });

  it("does not notify an existing but unverified user", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: ANOTHER_UUID, emailVerified: null });
    mockDb.membership.findUnique.mockResolvedValueOnce(null);
    mockDb.invitation.count.mockResolvedValueOnce(0);
    mockDb.invitation.upsert.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });

    await createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data);

    expect(mockDb.notification.create).not.toHaveBeenCalled();
    expectNoEmit();
  });

  it("notifies an existing verified user even when the org has vanished", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: ANOTHER_UUID, emailVerified: new Date() });
    mockDb.membership.findUnique.mockResolvedValueOnce(null);
    mockDb.invitation.count.mockResolvedValueOnce(0);
    mockDb.invitation.upsert.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.org.findUnique.mockResolvedValueOnce(null);
    mockDb.user.findUnique.mockResolvedValueOnce(null); // getActorName
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data);

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: "Someone invited you to an organization",
        }) as unknown,
      }),
    );
  });

  it("falls back to an empty org name and 'Someone' when they vanish", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);
    mockDb.invitation.count.mockResolvedValueOnce(0);
    mockDb.invitation.upsert.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.org.findUnique.mockResolvedValueOnce(null);
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data);

    expect(mockSendOrgInviteEmail).toHaveBeenCalledWith(
      FAKE_SENDER,
      expect.objectContaining({ orgName: "", inviterName: "Someone" }),
    );
  });

  it("propagates an email delivery failure without notifying anyone", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: ANOTHER_UUID, emailVerified: new Date() });
    mockDb.membership.findUnique.mockResolvedValueOnce(null);
    mockDb.invitation.count.mockResolvedValueOnce(0);
    mockDb.invitation.upsert.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockSendOrgInviteEmail.mockRejectedValueOnce(new Error("Resend down"));

    await expect(
      createInvitation(db, mockIo, VALID_ORG_ID, VALID_USER.id, VALID_USER.email, data),
    ).rejects.toThrow("Resend down");
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });
});

describe("listInvitationsForOrg", () => {
  it("maps rows to the admin table shape", async () => {
    const expired = buildInvitationWithInviter({ id: "expired-1", expiresAt: new Date(0) });
    const active = buildInvitationWithInviter({ id: "active-1" });
    mockDb.invitation.findMany.mockResolvedValueOnce([expired, active]);

    const result = await listInvitationsForOrg(db, VALID_ORG_ID);

    expect(result).toEqual([
      expect.objectContaining({ id: "expired-1", inviterName: VALID_USER.name }),
      expect.objectContaining({ id: "active-1", inviterName: VALID_USER.name }),
    ]);
  });

  it("reports a null inviterName when the inviter has no account", async () => {
    const row = { ...buildInvitationWithInviter(), invitedBy: null };
    mockDb.invitation.findMany.mockResolvedValueOnce([row]);

    const [result] = await listInvitationsForOrg(db, VALID_ORG_ID);

    expect(result?.inviterName).toBeNull();
  });
});

describe("revokeInvitation", () => {
  it("emits INVITATION_RESOLVED on success, excluding the acting admin's own room", async () => {
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      revokeInvitation(db, mockIo, VALID_INVITATION_ID, VALID_ORG_ID, VALID_USER.id),
    ).resolves.toEqual({
      success: true,
    });
    expectEmittedToOrg(
      VALID_ORG_ID,
      SOCKET_EVENTS.INVITATION_RESOLVED,
      { invitationId: VALID_INVITATION_ID, orgId: VALID_ORG_ID, status: "REVOKED" },
      VALID_USER.id,
    );
  });

  it("throws CONFLICT when the invitation is no longer pending", async () => {
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      revokeInvitation(db, mockIo, VALID_INVITATION_ID, VALID_ORG_ID, VALID_USER.id),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expectNoEmit();
  });
});

describe("resendInvitation", () => {
  it("throws NOT_FOUND when the invitation doesn't exist", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(null);

    await expect(resendInvitation(db, VALID_INVITATION_ID, VALID_USER.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws CONFLICT when the invitation is no longer pending", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(buildInvitation({ status: "DECLINED" }));

    await expect(resendInvitation(db, VALID_INVITATION_ID, VALID_USER.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("throws TOO_MANY_REQUESTS with the remaining cooldown seconds while the cooldown is active", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(buildInvitation({ updatedAt: new Date() }));

    await expect(resendInvitation(db, VALID_INVITATION_ID, VALID_USER.id)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringMatching(
        /^Please wait \d+s before resending this invitation\.$/,
      ) as string,
    });
    expect(mockDb.invitation.updateMany).not.toHaveBeenCalled();
  });

  it("rotates the token and resends once the cooldown has elapsed", async () => {
    const staleInvitation = buildInvitation({
      email: INVITEE_EMAIL,
      updatedAt: new Date(0),
    });
    mockDb.invitation.findUnique.mockResolvedValueOnce(staleInvitation);
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.user.findUnique
      .mockResolvedValueOnce(null) // findUserByEmail - no account yet
      .mockResolvedValueOnce({ name: "Alice" }); // getActorName

    await expect(resendInvitation(db, VALID_INVITATION_ID, VALID_USER.id)).resolves.toEqual({
      success: true,
    });

    expect(mockDb.invitation.updateMany).toHaveBeenCalledWith({
      where: { id: VALID_INVITATION_ID, status: "PENDING" },
      data: { tokenHash: TOKEN_HASH, expiresAt: expect.any(Date) as Date },
    });
    expect(mockSendOrgInviteEmail).toHaveBeenCalledWith(
      FAKE_SENDER,
      expect.objectContaining({
        to: INVITEE_EMAIL,
        acceptUrl: expect.stringContaining(`/register?invite=${RAW_TOKEN}`) as string,
        isNewUser: true,
      }),
    );
  });

  it("falls back to an empty org name and 'Someone' when they vanish", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(
      buildInvitation({ email: INVITEE_EMAIL, updatedAt: new Date(0) }),
    );
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.org.findUnique.mockResolvedValueOnce(null);
    mockDb.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await resendInvitation(db, VALID_INVITATION_ID, VALID_USER.id);

    expect(mockSendOrgInviteEmail).toHaveBeenCalledWith(
      FAKE_SENDER,
      expect.objectContaining({ orgName: "", inviterName: "Someone" }),
    );
  });
});

describe("listMyInvitations", () => {
  it("maps pending rows to the invitee's own shape", async () => {
    const invitation = buildInvitation({ email: INVITEE_EMAIL });
    mockDb.invitation.findMany.mockResolvedValueOnce([{ ...invitation, org: { name: "Acme" } }]);

    await expect(listMyInvitations(db, INVITEE_EMAIL)).resolves.toEqual([
      {
        id: invitation.id,
        orgId: invitation.orgId,
        orgName: "Acme",
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    ]);
  });
});

describe("getInvitationPreviewByToken", () => {
  it("throws NOT_FOUND for an unknown token", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      getInvitationPreviewByToken(db, "bad-token", VALID_USER.email),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    ["DECLINED", "DECLINED"],
    ["ACCEPTED", "ALREADY_ACCEPTED"],
    ["REVOKED", "REVOKED"],
  ] as const)("maps status=%s to state=%s", async (status, state) => {
    mockDb.invitation.findUnique.mockResolvedValueOnce({
      ...buildInvitation({ status, email: VALID_USER.email }),
      org: { name: "Acme" },
      invitedBy: null,
    });

    await expect(getInvitationPreviewByToken(db, "token", VALID_USER.email)).resolves.toMatchObject(
      {
        state,
      },
    );
  });

  it("maps an expired PENDING invitation to EXPIRED", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce({
      ...buildInvitation({ email: VALID_USER.email, expiresAt: new Date(0) }),
      org: { name: "Acme" },
      invitedBy: null,
    });

    await expect(getInvitationPreviewByToken(db, "token", VALID_USER.email)).resolves.toMatchObject(
      {
        state: "EXPIRED",
      },
    );
  });

  it("maps a valid PENDING invitation addressed to someone else to WRONG_ACCOUNT", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce({
      ...buildInvitation({ email: "someone-else@example.com" }),
      org: { name: "Acme" },
      invitedBy: { name: "Alice" },
    });

    await expect(getInvitationPreviewByToken(db, "token", VALID_USER.email)).resolves.toMatchObject(
      {
        state: "WRONG_ACCOUNT",
        inviterName: "Alice",
      },
    );
  });

  it("maps a valid PENDING invitation addressed to the caller to VALID", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce({
      ...buildInvitation({ email: VALID_USER.email }),
      org: { name: "Acme" },
      invitedBy: null,
    });

    await expect(getInvitationPreviewByToken(db, "token", VALID_USER.email)).resolves.toMatchObject(
      {
        state: "VALID",
      },
    );
  });
});

describe("getInvitationPublicPreviewByToken", () => {
  it("throws NOT_FOUND for an unknown token", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(null);

    await expect(getInvitationPublicPreviewByToken(db, "bad-token")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("never reports WRONG_ACCOUNT (no session to compare against)", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce({
      ...buildInvitation({ email: INVITEE_EMAIL }),
      org: { name: "Acme" },
      invitedBy: null,
    });

    await expect(getInvitationPublicPreviewByToken(db, "token")).resolves.toEqual({
      email: INVITEE_EMAIL,
      orgName: "Acme",
      role: "MEMBER",
      state: "VALID",
    });
  });
});

describe("acceptInvitation / declineInvitation", () => {
  const sessionUser = { id: ANOTHER_UUID, email: INVITEE_EMAIL };

  beforeEach(() => {
    mockDb.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: typeof mockDb) => unknown)(mockDb)
        : Promise.all(arg as unknown[]),
    );
  });

  it("acceptInvitation resolves by invitationId, creates the membership, and notifies the inviter", async () => {
    const invitation = buildInvitation({ email: INVITEE_EMAIL, invitedById: VALID_USER.id });
    const membership = buildMembership({ userId: ANOTHER_UUID });
    mockDb.invitation.findUnique.mockResolvedValueOnce(invitation);
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.membership.upsert.mockResolvedValueOnce(membership);
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" }); // getActorName
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await expect(
      acceptInvitation(db, mockIo, sessionUser, { invitationId: invitation.id }),
    ).resolves.toEqual({ orgId: invitation.orgId, membership });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "INVITATION_ACCEPTED",
          userId: VALID_USER.id,
        }) as unknown,
      }),
    );
    expectEmittedToOrg(
      invitation.orgId,
      SOCKET_EVENTS.INVITATION_RESOLVED,
      { invitationId: invitation.id, orgId: invitation.orgId, status: "ACCEPTED" },
      sessionUser.id,
    );
  });

  it("acceptInvitation resolves by raw token", async () => {
    const invitation = buildInvitation({ email: INVITEE_EMAIL, invitedById: null });
    mockDb.invitation.findUnique.mockResolvedValueOnce({
      ...invitation,
      org: { id: invitation.orgId, name: "Acme" },
      invitedBy: null,
    });
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.membership.upsert.mockResolvedValueOnce(buildMembership({ userId: ANOTHER_UUID }));
    mockDb.org.findUnique.mockResolvedValueOnce(org);

    await expect(
      acceptInvitation(db, mockIo, sessionUser, { token: "raw-token" }),
    ).resolves.toMatchObject({ orgId: invitation.orgId });

    expect(mockHashToken).toHaveBeenCalledWith("raw-token");
    // invitedById null -> notifyInvitationResolved no-ops, no notification created
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("acceptInvitation throws NOT_FOUND when the invitation doesn't exist", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      acceptInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("acceptInvitation falls back to an empty org name when the org has vanished", async () => {
    const invitation = buildInvitation({ email: INVITEE_EMAIL, invitedById: VALID_USER.id });
    mockDb.invitation.findUnique.mockResolvedValueOnce(invitation);
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.membership.upsert.mockResolvedValueOnce(buildMembership({ userId: ANOTHER_UUID }));
    mockDb.org.findUnique.mockResolvedValueOnce(null);
    mockDb.user.findUnique.mockResolvedValueOnce(null); // getActorName
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await acceptInvitation(db, mockIo, sessionUser, { invitationId: invitation.id });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: "Someone accepted your invitation" }) as unknown,
      }),
    );
  });

  it("acceptInvitation throws FORBIDDEN when the caller isn't the invitee", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(
      buildInvitation({ email: "someone-else@example.com" }),
    );

    await expect(
      acceptInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockDb.invitation.updateMany).not.toHaveBeenCalled();
  });

  it("acceptInvitation throws CONFLICT when the invitation is no longer claimable", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      acceptInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("acceptInvitation re-throws an unexpected transaction error unwrapped", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.invitation.updateMany.mockRejectedValueOnce(new Error("Connection lost"));

    await expect(
      acceptInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toThrow("Connection lost");
  });

  it("declineInvitation marks it declined and notifies the inviter", async () => {
    const invitation = buildInvitation({ email: INVITEE_EMAIL, invitedById: VALID_USER.id });
    mockDb.invitation.findUnique.mockResolvedValueOnce(invitation);
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.org.findUnique.mockResolvedValueOnce(org);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await expect(
      declineInvitation(db, mockIo, sessionUser, { invitationId: invitation.id }),
    ).resolves.toEqual({ success: true });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "INVITATION_DECLINED" }) as unknown,
      }),
    );
    expectEmittedToOrg(
      invitation.orgId,
      SOCKET_EVENTS.INVITATION_RESOLVED,
      { invitationId: invitation.id, orgId: invitation.orgId, status: "DECLINED" },
      sessionUser.id,
    );
    expect(mockDb.membership.upsert).not.toHaveBeenCalled();
  });

  it("declineInvitation throws NOT_FOUND when the invitation doesn't exist", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      declineInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("declineInvitation throws NOT_FOUND for an unknown raw token", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      declineInvitation(db, mockIo, sessionUser, { token: "bad-token" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockHashToken).toHaveBeenCalledWith("bad-token");
  });

  it("declineInvitation falls back to an empty org name when the org has vanished", async () => {
    const invitation = buildInvitation({ email: INVITEE_EMAIL, invitedById: VALID_USER.id });
    mockDb.invitation.findUnique.mockResolvedValueOnce(invitation);
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.org.findUnique.mockResolvedValueOnce(null);
    mockDb.user.findUnique.mockResolvedValueOnce(null); // getActorName
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await declineInvitation(db, mockIo, sessionUser, { invitationId: invitation.id });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: "Someone declined your invitation" }) as unknown,
      }),
    );
  });

  it("declineInvitation throws CONFLICT when the invitation is no longer claimable", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.invitation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      declineInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("declineInvitation re-throws an unexpected transaction error unwrapped", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(buildInvitation({ email: INVITEE_EMAIL }));
    mockDb.invitation.updateMany.mockRejectedValueOnce(new Error("Connection lost"));

    await expect(
      declineInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toThrow("Connection lost");
  });

  it("declineInvitation throws FORBIDDEN when the caller isn't the invitee", async () => {
    mockDb.invitation.findUnique.mockResolvedValueOnce(
      buildInvitation({ email: "someone-else@example.com" }),
    );

    await expect(
      declineInvitation(db, mockIo, sessionUser, { invitationId: VALID_INVITATION_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("claimInvitationsForUser", () => {
  it("no-ops when the user can no longer be found", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await claimInvitationsForUser(db, mockIo, ANOTHER_UUID);

    expect(mockDb.invitation.findMany).not.toHaveBeenCalled();
    expectNoEmit();
  });

  it("notifies and emits for every pending invitation, without changing status", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce({ email: INVITEE_EMAIL }) // the newly-verified user
      .mockResolvedValueOnce({ name: "Alice" }); // getActorName
    const invitation = buildInvitation({ email: INVITEE_EMAIL, invitedById: VALID_USER.id });
    mockDb.invitation.findMany.mockResolvedValueOnce([{ ...invitation, org: { name: "Acme" } }]);
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await claimInvitationsForUser(db, mockIo, ANOTHER_UUID);

    expect(mockDb.invitation.updateMany).not.toHaveBeenCalled();
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ANOTHER_UUID,
          type: "MEMBER_INVITED",
          message: 'Alice invited you to "Acme"',
        }) as unknown,
      }),
    );
    expectEmittedToUser(ANOTHER_UUID, SOCKET_EVENTS.INVITATION_RECEIVED, {
      invitation: {
        id: invitation.id,
        orgId: invitation.orgId,
        orgName: "Acme",
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  });

  it("falls back to no actor name when the inviter's account was deleted", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ email: INVITEE_EMAIL });
    const invitation = buildInvitation({ email: INVITEE_EMAIL, invitedById: null });
    mockDb.invitation.findMany.mockResolvedValueOnce([{ ...invitation, org: { name: "Acme" } }]);
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await claimInvitationsForUser(db, mockIo, ANOTHER_UUID);

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: 'Someone invited you to "Acme"' }) as unknown,
      }),
    );
  });
});
