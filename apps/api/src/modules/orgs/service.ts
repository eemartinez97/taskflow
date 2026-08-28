import type {
  FormerAssignee,
  Membership,
  MembershipWithUser,
  Org,
  OrgWithMembership,
  PrismaClient,
  Role,
} from "@taskflow/database";
import type { CreateOrg, UpdateOrg } from "@taskflow/shared";

import {
  countTasksAssignedInOrg,
  createOrg,
  deleteOrg,
  findAdminUserIds,
  findFormerAssignees,
  findMembers,
  findMembership,
  findOrgById,
  findOrgsByUser,
  removeMember,
  updateMembershipCursorPref,
  updateMembershipRole,
  updateOrg,
} from "./repo";
import { TRPCError } from "../../trpc/init";
import type { AppServer } from "../../socket/events";
import { appCollectors } from "../../metrics";
import { notifyMemberLeft } from "../notifications/service";
import { fireAndForget } from "../../utils/fire-and-forget";

export async function listOrgs(db: PrismaClient, userId: string): Promise<OrgWithMembership[]> {
  return findOrgsByUser(db, userId);
}

export async function createOrgForUser(
  db: PrismaClient,
  userId: string,
  data: CreateOrg,
): Promise<Org> {
  const org = await createOrg(db, userId, data);
  appCollectors.orgsCreatedTotal.inc();
  return org;
}

export async function updateOrgById(
  db: PrismaClient,
  orgId: string,
  data: UpdateOrg,
): Promise<Org> {
  const org = await findOrgById(db, orgId);

  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });

  return updateOrg(db, orgId, data);
}

export async function deleteOrgById(db: PrismaClient, orgId: string): Promise<{ success: true }> {
  const org = await findOrgById(db, orgId);
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
  await deleteOrg(db, orgId);
  return { success: true };
}

export async function listMembers(db: PrismaClient, orgId: string): Promise<MembershipWithUser[]> {
  return findMembers(db, orgId);
}

/**
 * The org must always keep exactly one owner; transferring ownership is a
 * separate, explicitly confirmed action that doesn't exist yet (see
 * BACKLOG.md). Shared by removeMemberFromOrg, leaveOrg, and
 * updateMemberRoleInOrg so the single-owner invariant lives in one place
 * instead of three copy-pasted checks with independent wording.
 */
function assertNotOwner(membership: Membership, message: string): void {
  if (membership.role === "OWNER") {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

/**
 * Shared tail end of both leaveOrg and removeMemberFromOrg: fetch what's
 * needed to notify, delete the membership (assigneeId is deliberately left
 * untouched - see the org-nav epic's ex-member attribution decision), then
 * notify the org's OWNER/ADMIN - plus `userId` itself when `actorId` differs
 * from it (an admin-initiated removal, not a voluntary leave), so the
 * removed member gets a realtime signal too instead of silently losing
 * access. `actorId` equals `userId` for a voluntary leave and is the acting
 * admin's id for a removal - see notifyMemberLeft for how that's used to
 * word the message.
 *
 * Notification is fire-and-forget: the membership delete has already
 * committed by the time this runs, so a transient failure in the
 * notification write/socket emit must not turn an already-successful
 * leave/remove into a false error response (same pattern as
 * notifyTaskAssignedInBackground/notifyCommentCreatedInBackground).
 */
async function removeMembershipAndNotify(
  db: PrismaClient,
  io: AppServer,
  orgId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  // removeMember doesn't depend on the other three reads (or vice versa), so
  // it runs alongside them instead of waiting its own extra DB round trip.
  const [org, taskCount, adminIds] = await Promise.all([
    findOrgById(db, orgId),
    countTasksAssignedInOrg(db, orgId, userId),
    findAdminUserIds(db, orgId),
    removeMember(db, orgId, userId),
  ]);

  appCollectors.orgMembersRemovedTotal.inc({ reason: actorId === userId ? "left" : "removed" });

  fireAndForget(
    notifyMemberLeft(db, io, {
      recipientIds: actorId === userId ? adminIds : [...adminIds, userId],
      actorId,
      removedUserId: userId,
      orgId,
      orgName: org?.name ?? "",
      taskCount,
    }),
    "orgs: failed to notify admins of member departure",
    { orgId, userId },
  );
}

export async function removeMemberFromOrg(
  db: PrismaClient,
  io: AppServer,
  orgId: string,
  userId: string,
  actorId: string,
): Promise<{ success: true }> {
  const membership = await findMembership(db, orgId, userId);

  if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });

  assertNotOwner(membership, "The organization owner cannot be removed.");

  await removeMembershipAndNotify(db, io, orgId, userId, actorId);
  return { success: true };
}

/**
 * Self-scoped: the caller leaves their own membership. The OWNER role can
 * never leave - an org must always keep exactly one owner, and ownership
 * transfer doesn't exist yet (see BACKLOG.md), so the only exit for a sole
 * owner is deleting the org outright.
 */
export async function leaveOrg(
  db: PrismaClient,
  io: AppServer,
  orgId: string,
  userId: string,
): Promise<{ success: true }> {
  const membership = await findMembership(db, orgId, userId);

  if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found." });

  assertNotOwner(
    membership,
    "Transfer ownership before leaving, or delete the organization instead.",
  );

  await removeMembershipAndNotify(db, io, orgId, userId, userId);
  return { success: true };
}

/** Users still assigned to a task in this org but no longer members. */
export async function listFormerAssignees(
  db: PrismaClient,
  orgId: string,
): Promise<FormerAssignee[]> {
  return findFormerAssignees(db, orgId);
}

/**
 * Current members + former-but-still-assigned users, in one round trip -
 * apps/web's useAssigneeLookup needs both to resolve every task's assignee
 * name, and this is the hottest query on the board/task-detail views. Two
 * independent DB reads either way; this only collapses the network hop.
 */
export async function listAssigneeLookup(
  db: PrismaClient,
  orgId: string,
): Promise<{ members: MembershipWithUser[]; formerAssignees: FormerAssignee[] }> {
  const [members, formerAssignees] = await Promise.all([
    findMembers(db, orgId),
    findFormerAssignees(db, orgId),
  ]);
  return { members, formerAssignees };
}

export async function updateMemberRoleInOrg(
  db: PrismaClient,
  orgId: string,
  userId: string,
  role: Exclude<Role, "OWNER">,
): Promise<Membership> {
  const membership = await findMembership(db, orgId, userId);

  if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });

  assertNotOwner(membership, "The owner's role cannot be changed.");

  return updateMembershipRole(db, orgId, userId, role);
}

export async function updateCursorPreference(
  db: PrismaClient,
  orgId: string,
  userId: string,
  cursorsHidden: boolean,
): Promise<Membership> {
  return updateMembershipCursorPref(db, orgId, userId, cursorsHidden);
}
