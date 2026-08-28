import type { PrismaClient, Role } from "@taskflow/database";
import type {
  InvitableRole,
  InvitationPreview,
  InvitationPreviewState,
  InvitationRef,
  InviteMember,
  Membership,
  MyInvitation,
  OrgInvitation,
  SocketMyInvitation,
} from "@taskflow/shared";
import {
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_TTL_HOURS,
  MAX_PENDING_INVITATIONS_PER_ORG,
  SOCKET_EVENTS,
} from "@taskflow/shared";
import { sendOrgInviteEmail } from "@taskflow/mail";

import {
  acceptInvitationTx,
  countPendingInvitations,
  declineInvitationTx,
  findInvitationById,
  findInvitationByOrgAndEmail,
  findInvitationByTokenHash,
  findInvitationsForOrg,
  findPendingInvitationsForEmail,
  type InvitationPreviewRow,
  InvitationNotClaimableError,
  revokeInvitationIfPending,
  rotateInvitationToken,
  upsertInvitation,
} from "./repo";
import { findUserByEmail } from "../auth/repo";
import { generateRawToken, hashToken } from "../auth/tokens";
import { findMembership, findOrgById } from "../orgs/repo";
import {
  getActorName,
  notify,
  buildNotificationMessage,
  deleteMemberInvitedNotifications,
  notifyInvitationResolved,
  notifyMemberInvited,
} from "../notifications/service";
import { emitToOrg, emitToUser } from "../../socket/emit";
import type { AppServer } from "../../socket/events";
import type { CtxUser } from "../../trpc/init";
import { TRPCError } from "../../trpc/init";
import { env } from "../../config/env";
import { appCollectors } from "../../metrics";
import { getEmailSender } from "../../mail/sender";

/**
 * Case-insensitive check that the signed-in caller is the invitation's
 * addressee. This is the ONLY authorization on the self-scoped half of this
 * module (`listMine`, `getByToken`, `accept`, `decline`) - there is no
 * `orgId` in those inputs for `roleGuard`/`assertInvitationInOrg` to check.
 */
export function assertInvitationRecipient(sessionEmail: string, invitationEmail: string): void {
  if (sessionEmail.toLowerCase() !== invitationEmail.toLowerCase()) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This invitation is not addressed to you." });
  }
}

function toMyInvitationPayload(
  invitation: { id: string; orgId: string; role: Role; expiresAt: Date; createdAt: Date },
  orgName: string,
): SocketMyInvitation {
  return {
    id: invitation.id,
    orgId: invitation.orgId,
    orgName,
    // The Invitation_role_not_owner CHECK constraint guarantees this is never OWNER.
    role: invitation.role as InvitableRole,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

function toOrgInvitation(
  row: InvitationPreviewRow | Awaited<ReturnType<typeof findInvitationsForOrg>>[number],
): OrgInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role as InvitableRole,
    status: row.status,
    invitedById: row.invitedById,
    expiresAt: row.expiresAt,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    inviterName: row.invitedBy?.name ?? null,
  };
}

function buildAcceptUrl(rawToken: string, hasAccount: boolean): string {
  return hasAccount
    ? `${env.WEB_ORIGIN}/invitations/${rawToken}`
    : `${env.WEB_ORIGIN}/register?invite=${rawToken}`;
}

/**
 * Invites someone to the org by email. Admin/owner only (enforced by the
 * router's roleGuard).
 *
 * The invite email is AWAITED (not fire-and-forget): a delivery failure must
 * surface to the admin as an error instead of a false "invitation sent" -
 * the row stays PENDING either way, and `resend` is the recovery path.
 *
 * Notifies + emits INVITATION_RECEIVED only when the target already has a
 * verified account - an unverified or nonexistent account has nowhere to
 * receive an in-app notification yet (see `claimInvitationsForUser` for the
 * unverified case, triggered instead on email verification).
 */
export async function createInvitation(
  db: PrismaClient,
  io: AppServer,
  orgId: string,
  actorId: string,
  actorEmail: string,
  data: InviteMember,
): Promise<{ success: true }> {
  if (data.email.toLowerCase() === actorEmail.toLowerCase()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "You can't invite yourself." });
  }

  const existingUser = await findUserByEmail(db, data.email);
  if (existingUser) {
    const membership = await findMembership(db, orgId, existingUser.id);
    if (membership) {
      throw new TRPCError({ code: "CONFLICT", message: "This person is already a member." });
    }
  }

  // Without this, `create` could be called over and over for the same
  // still-pending address - each call re-sends the email, rotates the
  // token (silently invalidating the invitee's still-good link), and fires
  // another MEMBER_INVITED notification, with none of `resend`'s cooldown.
  // `resend` is the only intended path once a PENDING invite already exists.
  // Reuses resolveInvitationState (the same PENDING+expiresAt check
  // getInvitationPreviewByToken/getInvitationPublicPreviewByToken already
  // use) instead of re-deriving "is this invite still live" by hand here -
  // a PENDING row past its own expiresAt is deliberately still re-invitable
  // (see cleanupStaleInvitations's docblock: it stays that way for up to
  // STALE_INVITATION_GRACE_DAYS before the row is deleted, not flipped to
  // some EXPIRED status - InvitationStatus has no such member).
  const existingInvitation = await findInvitationByOrgAndEmail(db, orgId, data.email);
  if (existingInvitation && resolveInvitationState(existingInvitation) === "VALID") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This person already has a pending invitation. Use resend instead.",
    });
  }

  // Excludes `data.email`'s own row: re-inviting an already-pending address
  // only ever UPDATEs that row via upsertInvitation's orgId_email unique
  // constraint below, never adds a new one, so it must not count against the
  // cap it's already inside of.
  const pendingCount = await countPendingInvitations(db, orgId, data.email);
  if (pendingCount >= MAX_PENDING_INVITATIONS_PER_ORG) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "This organization has reached its limit of pending invitations.",
    });
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

  const [org, inviterName] = await Promise.all([findOrgById(db, orgId), getActorName(db, actorId)]);

  // Sent BEFORE the write below, same pattern as issueAuthToken's docblock:
  // if send fails, any pre-existing pending invitation for this email keeps
  // its still-working token/link untouched instead of being overwritten by
  // a link that never arrived.
  await sendOrgInviteEmail(getEmailSender(), {
    to: data.email,
    orgName: org?.name ?? "",
    inviterName: inviterName ?? "Someone",
    role: data.role,
    acceptUrl: buildAcceptUrl(rawToken, existingUser !== null),
    expiresInHours: INVITATION_TTL_HOURS,
    isNewUser: existingUser === null,
  });

  const invitation = await upsertInvitation(db, {
    orgId,
    email: data.email,
    role: data.role,
    tokenHash,
    expiresAt,
    invitedById: actorId,
  });
  appCollectors.invitationsSentTotal.inc();

  if (existingUser?.emailVerified) {
    await notifyMemberInvited(db, io, {
      recipientId: existingUser.id,
      actorId,
      orgId,
      orgName: org?.name ?? "",
    });
    emitToUser(io, existingUser.id, SOCKET_EVENTS.INVITATION_RECEIVED, {
      invitation: toMyInvitationPayload(invitation, org?.name ?? ""),
    });
  }

  return { success: true };
}

export async function listInvitationsForOrg(
  db: PrismaClient,
  orgId: string,
): Promise<OrgInvitation[]> {
  const rows = await findInvitationsForOrg(db, orgId);
  return rows.map(toOrgInvitation);
}

/** Revokes a still-pending invitation. Cross-org protection comes from the router's assertInvitationInOrg. */
export async function revokeInvitation(
  db: PrismaClient,
  io: AppServer,
  invitationId: string,
  orgId: string,
  actorId: string,
): Promise<{ success: true }> {
  const { count } = await revokeInvitationIfPending(db, invitationId);
  if (count === 0) {
    throw new TRPCError({ code: "CONFLICT", message: "This invitation is no longer pending." });
  }

  appCollectors.invitationsResolvedTotal.inc({ status: "REVOKED" });

  emitToOrg(
    io,
    orgId,
    SOCKET_EVENTS.INVITATION_RESOLVED,
    { invitationId, orgId, status: "REVOKED" },
    actorId,
  );

  return { success: true };
}

/** Re-sends a still-pending invitation with a fresh token, subject to a per-invitation cooldown. */
export async function resendInvitation(
  db: PrismaClient,
  invitationId: string,
  actorId: string,
): Promise<{ success: true }> {
  const invitation = await findInvitationById(db, invitationId);
  if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
  if (invitation.status !== "PENDING") {
    throw new TRPCError({ code: "CONFLICT", message: "This invitation is no longer pending." });
  }

  const cooldownEndsAt = invitation.updatedAt.getTime() + INVITATION_RESEND_COOLDOWN_MS;
  const remainingMs = cooldownEndsAt - Date.now();
  if (remainingMs > 0) {
    // Round up, not down - "0s" would read as "should be allowed right now"
    // when there's still a sliver of cooldown left.
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Please wait ${String(remainingSeconds)}s before resending this invitation.`,
    });
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

  const [org, existingUser, inviterName] = await Promise.all([
    findOrgById(db, invitation.orgId),
    findUserByEmail(db, invitation.email),
    getActorName(db, actorId),
  ]);

  // Sent BEFORE rotating the token below - same pattern as issueAuthToken's
  // docblock: if send fails, the invitee's still-working old link stays
  // valid instead of being rotated out from under them with no replacement.
  await sendOrgInviteEmail(getEmailSender(), {
    to: invitation.email,
    orgName: org?.name ?? "",
    inviterName: inviterName ?? "Someone",
    role: invitation.role,
    acceptUrl: buildAcceptUrl(rawToken, existingUser !== null),
    expiresInHours: INVITATION_TTL_HOURS,
    isNewUser: existingUser === null,
  });

  await rotateInvitationToken(db, invitationId, tokenHash, expiresAt);
  appCollectors.invitationsResentTotal.inc();

  return { success: true };
}

export async function listMyInvitations(db: PrismaClient, email: string): Promise<MyInvitation[]> {
  const rows = await findPendingInvitationsForEmail(db, email);
  return rows.map((row) => toMyInvitationPayload(row, row.org.name));
}

function resolveInvitationState(
  invitation: { status: string; expiresAt: Date; email: string },
  sessionEmail?: string,
): InvitationPreviewState {
  if (invitation.status === "DECLINED") return "DECLINED";
  if (invitation.status === "ACCEPTED") return "ALREADY_ACCEPTED";
  if (invitation.status === "REVOKED") return "REVOKED";
  if (invitation.expiresAt.getTime() < Date.now()) return "EXPIRED";
  if (sessionEmail && sessionEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    return "WRONG_ACCOUNT";
  }
  return "VALID";
}

/**
 * Resolves an invitation by raw token for the signed-in viewer.
 * Deliberately never returns the invitee's email - see invitationPreviewSchema's
 * docblock; `WRONG_ACCOUNT` is what neutralizes a leaked link.
 */
export async function getInvitationPreviewByToken(
  db: PrismaClient,
  token: string,
  sessionEmail: string,
): Promise<InvitationPreview> {
  const invitation = await findInvitationByTokenHash(db, hashToken(token));
  if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });

  return {
    invitationId: invitation.id,
    orgId: invitation.orgId,
    orgName: invitation.org.name,
    role: invitation.role as InvitableRole,
    inviterName: invitation.invitedBy?.name ?? null,
    expiresAt: invitation.expiresAt,
    state: resolveInvitationState(invitation, sessionEmail),
  };
}

export interface InvitationPublicPreview {
  email: string;
  orgName: string;
  role: InvitableRole;
  state: InvitationPreviewState;
}

/**
 * Minimal, unauthenticated preview for prefilling /register?invite=. Safe to
 * include the email here (unlike the authenticated preview above): the
 * token is 256 bits of entropy, and its holder is the intended recipient.
 */
export async function getInvitationPublicPreviewByToken(
  db: PrismaClient,
  token: string,
): Promise<InvitationPublicPreview> {
  const invitation = await findInvitationByTokenHash(db, hashToken(token));
  if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });

  return {
    email: invitation.email,
    orgName: invitation.org.name,
    role: invitation.role as InvitableRole,
    state: resolveInvitationState(invitation),
  };
}

async function resolveInvitationForRef(
  db: PrismaClient,
  ref: InvitationRef,
): Promise<InvitationPreviewRow | NonNullable<Awaited<ReturnType<typeof findInvitationById>>>> {
  const invitation =
    "invitationId" in ref
      ? await findInvitationById(db, ref.invitationId)
      : await findInvitationByTokenHash(db, hashToken(ref.token));

  /* v8 ignore next -- both outcomes are exercised (service.test.ts's accept/decline
   * NOT_FOUND-by-id and NOT_FOUND-by-token cases, plus every success case), but v8's
   * branch mapping conflates this with the identically-shaped guard in
   * getInvitationPreviewByToken/getInvitationPublicPreviewByToken and reports it as
   * a phantom gap. */
  if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
  return invitation;
}

export interface AcceptInvitationResult {
  orgId: string;
  membership: Membership;
}

/** Accepts an invitation - creates (or leaves untouched) the membership. */
export async function acceptInvitation(
  db: PrismaClient,
  io: AppServer,
  sessionUser: CtxUser,
  ref: InvitationRef,
): Promise<AcceptInvitationResult> {
  const invitation = await resolveInvitationForRef(db, ref);
  assertInvitationRecipient(sessionUser.email, invitation.email);

  let membership;
  try {
    membership = await acceptInvitationTx(
      db,
      invitation.id,
      invitation.orgId,
      sessionUser.id,
      invitation.role,
    );
  } catch (error) {
    if (error instanceof InvitationNotClaimableError) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This invitation can no longer be accepted.",
      });
    }
    throw error;
  }

  appCollectors.invitationsResolvedTotal.inc({ status: "ACCEPTED" });

  // Neither depends on the other - same pattern as createInvitation's own
  // Promise.all([findOrgById, getActorName]) above.
  const [org] = await Promise.all([
    findOrgById(db, invitation.orgId),
    deleteMemberInvitedNotifications(db, sessionUser.id, invitation.orgId),
  ]);
  await notifyInvitationResolved(db, io, {
    recipientId: invitation.invitedById,
    actorId: sessionUser.id,
    orgId: invitation.orgId,
    orgName: org?.name ?? "",
    type: "INVITATION_ACCEPTED",
  });
  emitToOrg(
    io,
    invitation.orgId,
    SOCKET_EVENTS.INVITATION_RESOLVED,
    { invitationId: invitation.id, orgId: invitation.orgId, status: "ACCEPTED" },
    sessionUser.id,
  );

  return { orgId: invitation.orgId, membership };
}

/** Declines an invitation. */
export async function declineInvitation(
  db: PrismaClient,
  io: AppServer,
  sessionUser: CtxUser,
  ref: InvitationRef,
): Promise<{ success: true }> {
  const invitation = await resolveInvitationForRef(db, ref);
  assertInvitationRecipient(sessionUser.email, invitation.email);

  try {
    await declineInvitationTx(db, invitation.id);
  } catch (error) {
    if (error instanceof InvitationNotClaimableError) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This invitation can no longer be declined.",
      });
    }
    throw error;
  }

  appCollectors.invitationsResolvedTotal.inc({ status: "DECLINED" });

  // Neither depends on the other - same pattern as createInvitation's own
  // Promise.all([findOrgById, getActorName]) above.
  const [org] = await Promise.all([
    findOrgById(db, invitation.orgId),
    deleteMemberInvitedNotifications(db, sessionUser.id, invitation.orgId),
  ]);
  await notifyInvitationResolved(db, io, {
    recipientId: invitation.invitedById,
    actorId: sessionUser.id,
    orgId: invitation.orgId,
    orgName: org?.name ?? "",
    type: "INVITATION_DECLINED",
  });
  emitToOrg(
    io,
    invitation.orgId,
    SOCKET_EVENTS.INVITATION_RESOLVED,
    { invitationId: invitation.id, orgId: invitation.orgId, status: "DECLINED" },
    sessionUser.id,
  );

  return { success: true };
}

/**
 * Called from auth.verifyEmail's service on the `freshlyActivated`
 * transition: one MEMBER_INVITED notification per PENDING, unexpired
 * invitation addressed to the newly-verified email - WITHOUT changing any
 * invitation's status. Verifying an email must never silently join an org;
 * the user still has to explicitly accept. No double-notification with
 * `createInvitation`'s own notify step: that one only fires for an
 * ALREADY-verified account, and this only fires on the single activation
 * transition - the two are disjoint by construction.
 */
export async function claimInvitationsForUser(
  db: PrismaClient,
  io: AppServer,
  userId: string,
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return;

  const rows = await findPendingInvitationsForEmail(db, user.email);

  for (const invitation of rows) {
    const actorName = invitation.invitedById
      ? await getActorName(db, invitation.invitedById)
      : null;

    await notify(db, io, {
      userId,
      actorId: invitation.invitedById ?? undefined,
      type: "MEMBER_INVITED",
      message: buildNotificationMessage("MEMBER_INVITED", actorName, invitation.org.name),
      entityId: invitation.orgId,
      entityType: "org",
    });
    emitToUser(io, userId, SOCKET_EVENTS.INVITATION_RECEIVED, {
      invitation: toMyInvitationPayload(invitation, invitation.org.name),
    });
  }
}
