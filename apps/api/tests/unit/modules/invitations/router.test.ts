import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvitationsRouter } from "../../../../src/modules/invitations/router";
import * as service from "../../../../src/modules/invitations/service";
import { VALID_INVITATION_ID } from "../../../factories";
import { db, VALID_ORG_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import { callerFor, expectTRPCError, grantRole } from "../../../support/trpc";

vi.mock("../../../../src/modules/invitations/service");

const router = createInvitationsRouter(mockIo);
const caller = () => callerFor(router);

describe("invitations router", () => {
  beforeEach(() => {
    grantRole("ADMIN");
    // revoke/resend carry invitationId - roleGuard's IDOR guard
    // (assertInvitationInOrg) resolves it for real before reaching the
    // (mocked) service layer.
    mockDb.invitation.findUnique.mockResolvedValue({ orgId: VALID_ORG_ID });
  });

  it("create -> createInvitation with io and caller identity injected", async () => {
    const data = { email: "bob@example.com", role: "MEMBER" as const };

    await caller().create({ orgId: VALID_ORG_ID, data });

    expect(service.createInvitation).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_ORG_ID,
      VALID_USER.id,
      VALID_USER.email,
      data,
    );
  });

  it("listForOrg -> listInvitationsForOrg", async () => {
    await caller().listForOrg({ orgId: VALID_ORG_ID });

    expect(service.listInvitationsForOrg).toHaveBeenCalledWith(db, VALID_ORG_ID);
  });

  it("revoke -> revokeInvitation with io injected", async () => {
    await caller().revoke({ orgId: VALID_ORG_ID, invitationId: VALID_INVITATION_ID });

    expect(service.revokeInvitation).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_INVITATION_ID,
      VALID_ORG_ID,
      VALID_USER.id,
    );
  });

  it("resend -> resendInvitation", async () => {
    await caller().resend({ orgId: VALID_ORG_ID, invitationId: VALID_INVITATION_ID });

    expect(service.resendInvitation).toHaveBeenCalledWith(db, VALID_INVITATION_ID, VALID_USER.id);
  });

  it("listMine -> listMyInvitations(db, ctx.user.email)", async () => {
    await caller().listMine();

    expect(service.listMyInvitations).toHaveBeenCalledWith(db, VALID_USER.email);
  });

  it("getByToken -> getInvitationPreviewByToken(db, token, ctx.user.email)", async () => {
    await caller().getByToken({ token: "raw-token" });

    expect(service.getInvitationPreviewByToken).toHaveBeenCalledWith(
      db,
      "raw-token",
      VALID_USER.email,
    );
  });

  it("getByTokenPublic -> getInvitationPublicPreviewByToken, without a session", async () => {
    await callerFor(router, null).getByTokenPublic({ token: "raw-token" });

    expect(service.getInvitationPublicPreviewByToken).toHaveBeenCalledWith(db, "raw-token");
  });

  it("accept -> acceptInvitation(db, io, ctx.user, input)", async () => {
    await caller().accept({ invitationId: VALID_INVITATION_ID });

    expect(service.acceptInvitation).toHaveBeenCalledWith(db, mockIo, VALID_USER, {
      invitationId: VALID_INVITATION_ID,
    });
  });

  it("accept accepts a token ref instead of an invitationId", async () => {
    await caller().accept({ token: "raw-token" });

    expect(service.acceptInvitation).toHaveBeenCalledWith(db, mockIo, VALID_USER, {
      token: "raw-token",
    });
  });

  it("decline -> declineInvitation(db, io, ctx.user, input)", async () => {
    await caller().decline({ invitationId: VALID_INVITATION_ID });

    expect(service.declineInvitation).toHaveBeenCalledWith(db, mockIo, VALID_USER, {
      invitationId: VALID_INVITATION_ID,
    });
  });
});

describe("invitations router RBAC", () => {
  it.each([
    [
      "create",
      () =>
        caller().create({
          orgId: VALID_ORG_ID,
          data: { email: "b@x.com", role: "MEMBER" as const },
        }),
    ],
    ["listForOrg", () => caller().listForOrg({ orgId: VALID_ORG_ID })],
    ["revoke", () => caller().revoke({ orgId: VALID_ORG_ID, invitationId: VALID_INVITATION_ID })],
    ["resend", () => caller().resend({ orgId: VALID_ORG_ID, invitationId: VALID_INVITATION_ID })],
  ])("%s requires OWNER or ADMIN", async (_name, call) => {
    grantRole("MEMBER");

    await expectTRPCError(call(), "FORBIDDEN");
  });

  it("listMine requires a session", async () => {
    await expectTRPCError(callerFor(router, null).listMine(), "UNAUTHORIZED");
  });

  it("getByToken requires a session", async () => {
    await expectTRPCError(
      callerFor(router, null).getByToken({ token: "raw-token" }),
      "UNAUTHORIZED",
    );
  });

  it("accept requires a session", async () => {
    await expectTRPCError(
      callerFor(router, null).accept({ invitationId: VALID_INVITATION_ID }),
      "UNAUTHORIZED",
    );
  });

  it("decline requires a session", async () => {
    await expectTRPCError(
      callerFor(router, null).decline({ invitationId: VALID_INVITATION_ID }),
      "UNAUTHORIZED",
    );
  });
});
