import type {
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
  type FormerAssignee,
} from "./repo";
import { TRPCError } from "../../trpc/init";
import type { AppServer } from "../../socket/events";
import { notifyMemberLeft } from "../notifications/service";

export async function listOrgs(db: PrismaClient, userId: string): Promise<OrgWithMembership[]> {
  return findOrgsByUser(db, userId);
}

export async function createOrgForUser(
  db: PrismaClient,
  userId: string,
  data: CreateOrg,
): Promise<Org> {
  return createOrg(db, userId, data);
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
 * Shared tail end of both leaveOrg and removeMemberFromOrg: fetch what's
 * needed to notify, delete the membership (assigneeId is deliberately left
 * untouched - see the org-nav epic's ex-member attribution decision), then
 * notify the org's OWNER/ADMIN. One behavior to understand for both the
 * voluntary-leave and admin-removal paths.
 */
async function removeMembershipAndNotify(
  db: PrismaClient,
  io: AppServer,
  orgId: string,
  userId: string,
): Promise<void> {
  const [org, taskCount, adminIds] = await Promise.all([
    findOrgById(db, orgId),
    countTasksAssignedInOrg(db, orgId, userId),
    findAdminUserIds(db, orgId),
  ]);

  await removeMember(db, orgId, userId);

  await notifyMemberLeft(db, io, {
    recipientIds: adminIds,
    actorId: userId,
    orgId,
    orgName: org?.name ?? "",
    taskCount,
  });
}

export async function removeMemberFromOrg(
  db: PrismaClient,
  io: AppServer,
  orgId: string,
  userId: string,
): Promise<{ success: true }> {
  const membership = await findMembership(db, orgId, userId);

  if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });

  if (membership.role === "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The organization owner cannot be removed.",
    });
  }

  await removeMembershipAndNotify(db, io, orgId, userId);
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

  if (membership.role === "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Transfer ownership before leaving, or delete the organization instead.",
    });
  }

  await removeMembershipAndNotify(db, io, orgId, userId);
  return { success: true };
}

/** Users still assigned to a task in this org but no longer members. */
export async function listFormerAssignees(
  db: PrismaClient,
  orgId: string,
): Promise<FormerAssignee[]> {
  return findFormerAssignees(db, orgId);
}

export async function updateMemberRoleInOrg(
  db: PrismaClient,
  orgId: string,
  userId: string,
  role: Exclude<Role, "OWNER">,
): Promise<Membership> {
  const membership = await findMembership(db, orgId, userId);

  if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });

  // The org must always keep exactly one owner; transferring ownership is a
  // separate, explicitly confirmed action.
  if (membership.role === "OWNER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "The owner's role cannot be changed." });
  }

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
