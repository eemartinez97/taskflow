import type {
  MembershipWithUser,
  Membership,
  Org,
  OrgWithMembership,
  PrismaClient,
} from "@taskflow/database";
import { membershipWithUser, orgWithMembership } from "@taskflow/database";
import type { CreateOrg, InviteMember, UpdateOrg } from "@taskflow/shared";
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

export async function inviteMember(
  db: PrismaClient,
  orgId: string,
  data: InviteMember,
): Promise<Membership> {
  const user = await db.user.findUnique({ where: { email: data.email } });

  if (!user) throw new Error(`NO_USER:${data.email}`);

  return db.membership.create({
    data: { orgId, userId: user.id, role: data.role },
  });
}

export async function removeMember(db: PrismaClient, orgId: string, userId: string): Promise<void> {
  await db.membership.delete({
    where: { orgId_userId: { orgId, userId } },
  });
}
