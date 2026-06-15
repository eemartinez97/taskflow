import type { Membership, Org, PrismaClient } from "@taskflow/database";
import type { CreateOrg, InviteMember, UpdateOrg } from "@taskflow/shared";
import { stripUndefined } from "../../utils/prisma.js";

export type OrgWithRole = Org & { membership: Pick<Membership, "role"> };

export async function findOrgsByUser(db: PrismaClient, userId: string): Promise<OrgWithRole[]> {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    ...m.org,
    membership: { role: m.role },
  }));
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

export async function findMembers(
  db: PrismaClient,
  orgId: string,
): Promise<(Membership & { user: { id: string; name: string | null; email: string } })[]> {
  return db.membership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMember(
  db: PrismaClient,
  orgId: string,
  data: InviteMember,
): Promise<Membership> {
  const user = await db.user.findUnique({ where: { email: data.email } });

  if (!user) {
    throw new Error(`NO_USER:${data.email}`);
  }

  return db.membership.create({
    data: { orgId, userId: user.id, role: data.role },
  });
}

export async function removeMember(db: PrismaClient, orgId: string, userId: string): Promise<void> {
  await db.membership.delete({
    where: { orgId_userId: { orgId, userId } },
  });
}
