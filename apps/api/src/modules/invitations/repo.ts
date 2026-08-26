import type {
  Invitation,
  InvitationWithInviter,
  Membership,
  Prisma,
  PrismaClient,
  Role,
} from "@taskflow/database";
import { invitationWithInviter, invitationWithOrg } from "@taskflow/database";

/**
 * Thrown by `acceptInvitationTx` / `declineInvitationTx` when the conditional
 * `updateMany` matched zero rows - the invitation was already resolved
 * (accepted/declined/revoked) or expired between the caller's read and the
 * write. Callers should treat this as "no longer actionable" (409).
 */
export class InvitationNotClaimableError extends Error {
  constructor() {
    super("Invitation is no longer pending");
    this.name = "InvitationNotClaimableError";
  }
}

export interface UpsertInvitationData {
  orgId: string;
  email: string;
  role: Role;
  tokenHash: string;
  expiresAt: Date;
  invitedById: string;
}

/**
 * The whole re-invite story: one atomic statement resurrects a DECLINED /
 * REVOKED / expired / still-pending row identically - new token (the old
 * link dies because `tokenHash` is overwritten), new expiry, no branching,
 * no racing duplicates. Relies on the `@@unique([orgId, email])` constraint.
 */
export async function upsertInvitation(
  db: PrismaClient,
  data: UpsertInvitationData,
): Promise<Invitation> {
  return db.invitation.upsert({
    where: { orgId_email: { orgId: data.orgId, email: data.email } },
    create: {
      orgId: data.orgId,
      email: data.email,
      role: data.role,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      invitedById: data.invitedById,
    },
    update: {
      role: data.role,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      status: "PENDING",
      invitedById: data.invitedById,
      respondedAt: null,
    },
  });
}

export async function findInvitationById(db: PrismaClient, id: string): Promise<Invitation | null> {
  return db.invitation.findUnique({ where: { id } });
}

/** Looks up the single row `@@unique([orgId, email])` guarantees for this pair, if any. */
export async function findInvitationByOrgAndEmail(
  db: PrismaClient,
  orgId: string,
  email: string,
): Promise<Invitation | null> {
  return db.invitation.findUnique({ where: { orgId_email: { orgId, email } } });
}

const invitationWithOrgAndInviter = { ...invitationWithOrg, ...invitationWithInviter };

export type InvitationPreviewRow = Prisma.InvitationGetPayload<{
  include: typeof invitationWithOrgAndInviter;
}>;

/** Resolves an invitation by its raw token's hash, with org + inviter names for display. */
export async function findInvitationByTokenHash(
  db: PrismaClient,
  tokenHash: string,
): Promise<InvitationPreviewRow | null> {
  return db.invitation.findUnique({
    where: { tokenHash },
    include: invitationWithOrgAndInviter,
  });
}

export async function findInvitationsForOrg(
  db: PrismaClient,
  orgId: string,
): Promise<InvitationWithInviter[]> {
  return db.invitation.findMany({
    where: { orgId },
    include: invitationWithInviter,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * `excludeEmail`, when given, leaves that address's own PENDING row out of
 * the count - re-inviting it only ever UPDATEs that row via
 * `upsertInvitation`'s `orgId_email` unique constraint, never adds a new
 * one, so it must not count against the cap it's already inside of.
 */
export async function countPendingInvitations(
  db: PrismaClient,
  orgId: string,
  excludeEmail?: string,
): Promise<number> {
  return db.invitation.count({
    where: { orgId, status: "PENDING", ...(excludeEmail ? { email: { not: excludeEmail } } : {}) },
  });
}

/**
 * The invitee's own "pending invitations" list - self-scoped by the caller's
 * session email. Excludes expired rows: `InvitationStatus` has no EXPIRED
 * member (see the Prisma model's docblock), so an inbox that didn't filter
 * this out would show dead invites indefinitely.
 */
export async function findPendingInvitationsForEmail(
  db: PrismaClient,
  email: string,
): Promise<(Invitation & { org: { name: string } })[]> {
  return db.invitation.findMany({
    where: { email, status: "PENDING", expiresAt: { gt: new Date() } },
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Admin-initiated: revokes a still-pending invitation. Conditional so a race with accept/decline can't un-resolve it. */
export async function revokeInvitationIfPending(
  db: PrismaClient,
  invitationId: string,
): Promise<{ count: number }> {
  return db.invitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { status: "REVOKED" },
  });
}

/** Rotates the token/expiry of a still-pending invitation - the old link dies immediately. */
export async function rotateInvitationToken(
  db: PrismaClient,
  invitationId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db.invitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { tokenHash, expiresAt },
  });
}

/**
 * Mirrors `consumeEmailVerification`'s conditional-`updateMany` pattern
 * (modules/auth/tokens.ts): the PENDING + not-expired guard on the update
 * itself, not a separate read-then-write, is what makes this race-safe.
 * Never downgrades a sitting membership - `update: {}` leaves an existing
 * ADMIN/OWNER's role untouched if they somehow re-accept a stale invite.
 */
export async function acceptInvitationTx(
  db: PrismaClient,
  invitationId: string,
  orgId: string,
  userId: string,
  role: Role,
): Promise<Membership> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.invitation.updateMany({
      where: { id: invitationId, status: "PENDING", expiresAt: { gt: new Date() } },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    if (count === 0) throw new InvitationNotClaimableError();

    return tx.membership.upsert({
      where: { orgId_userId: { orgId, userId } },
      create: { orgId, userId, role },
      update: {},
    });
  });
}

export async function declineInvitationTx(db: PrismaClient, invitationId: string): Promise<void> {
  const { count } = await db.invitation.updateMany({
    where: { id: invitationId, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  if (count === 0) throw new InvitationNotClaimableError();
}
