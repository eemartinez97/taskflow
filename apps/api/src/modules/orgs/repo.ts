import type {
  MembershipWithUser,
  Membership,
  Org,
  OrgWithMembership,
  PrismaClient,
  Role,
} from "@taskflow/database";
import { membershipWithUser, orgWithMembership } from "@taskflow/database";
import type { CreateOrg, UpdateOrg } from "@taskflow/shared";
import { stripUndefined } from "../../utils/prisma";

export async function findOrgsByUser(
  db: PrismaClient,
  userId: string,
): Promise<OrgWithMembership[]> {
  return db.org.findMany({
    where: { memberships: { some: { userId } } },
    include: {
      memberships: {
        ...orgWithMembership.memberships,
        where: { userId },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findOrgById(db: PrismaClient, orgId: string): Promise<Org | null> {
  return db.org.findUnique({ where: { id: orgId } });
}

export async function createOrg(db: PrismaClient, userId: string, data: CreateOrg): Promise<Org> {
  return db.org.create({
    data: {
      ...data,
      memberships: {
        create: { userId, role: "OWNER" },
      },
    },
  });
}

export async function updateOrg(db: PrismaClient, orgId: string, data: UpdateOrg): Promise<Org> {
  // stripUndefined: required with exactOptionalPropertyTypes - Zod .partial()
  // produces { field?: string | undefined } but Prisma expects { field?: string }
  return db.org.update({ where: { id: orgId }, data: stripUndefined(data) });
}

export async function deleteOrg(db: PrismaClient, orgId: string): Promise<void> {
  await db.org.delete({ where: { id: orgId } });
}

export async function findMembers(db: PrismaClient, orgId: string): Promise<MembershipWithUser[]> {
  return db.membership.findMany({
    where: { orgId },
    include: membershipWithUser,
    orderBy: { createdAt: "asc" },
  });
}

export async function removeMember(db: PrismaClient, orgId: string, userId: string): Promise<void> {
  await db.membership.delete({
    where: { orgId_userId: { orgId, userId } },
  });
}

export async function findMembership(
  db: PrismaClient,
  orgId: string,
  userId: string,
): Promise<Membership | null> {
  return db.membership.findUnique({ where: { orgId_userId: { orgId, userId } } });
}

export async function updateMembershipRole(
  db: PrismaClient,
  orgId: string,
  userId: string,
  role: Role,
): Promise<Membership> {
  return db.membership.update({
    where: { orgId_userId: { orgId, userId } },
    data: { role },
  });
}

export async function updateMembershipCursorPref(
  db: PrismaClient,
  orgId: string,
  userId: string,
  cursorsHidden: boolean,
): Promise<Membership> {
  return db.membership.update({
    where: { orgId_userId: { orgId, userId } },
    data: { cursorsHidden },
  });
}

/** OWNER/ADMIN userIds for an org - the recipients of a MEMBER_LEFT notification. */
export async function findAdminUserIds(db: PrismaClient, orgId: string): Promise<string[]> {
  const rows = await db.membership.findMany({
    where: { orgId, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

/** Counts tasks assigned to `userId` within `orgId`, via the task -> column -> board -> project chain. */
export async function countTasksAssignedInOrg(
  db: PrismaClient,
  orgId: string,
  userId: string,
): Promise<number> {
  return db.task.count({
    where: { assigneeId: userId, column: { board: { project: { orgId } } } },
  });
}

export interface FormerAssignee {
  id: string;
  name: string | null;
}

/**
 * Users still assigned to a task in this org who are no longer members -
 * task attribution is deliberately preserved when someone leaves/is removed
 * (see removeMembershipAndNotify), so the client needs a way to resolve
 * their display name. Name only, no email - see the org-nav epic's privacy
 * decision for ex-members.
 */
export async function findFormerAssignees(
  db: PrismaClient,
  orgId: string,
): Promise<FormerAssignee[]> {
  return db.user.findMany({
    where: {
      assignedTasks: { some: { column: { board: { project: { orgId } } } } },
      memberships: { none: { orgId } },
    },
    select: { id: true, name: true },
  });
}
