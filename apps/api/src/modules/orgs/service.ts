import type { Membership, Org, PrismaClient } from "@taskflow/database";
import {
  type OrgWithRole,
  createOrg,
  deleteOrg,
  findMembers,
  findOrgById,
  findOrgsByUser,
  inviteMember,
  removeMember,
  updateOrg,
} from "./repo.js";
import type { CreateOrg, InviteMember, UpdateOrg } from "@taskflow/shared";
import { TRPCError } from "../../trpc/init.js";

export async function listOrgs(db: PrismaClient, userId: string): Promise<OrgWithRole[]> {
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

export async function deleteOrgById(
  db: PrismaClient,
  orgId: string,
): Promise<{ success: boolean }> {
  const org = await findOrgById(db, orgId);

  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });

  await deleteOrg(db, orgId);

  return { success: true };
}

export async function listMembers(
  db: PrismaClient,
  orgId: string,
): Promise<(Membership & { user: { id: string; name: string | null; email: string } })[]> {
  return findMembers(db, orgId);
}

export async function inviteMemberToOrg(
  db: PrismaClient,
  orgId: string,
  data: InviteMember,
): Promise<Membership> {
  try {
    return await inviteMember(db, orgId, data);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("NO_USER:")) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `No account found for ${data.email}. Ask them to register first.`,
      });
    }
    // Re-throw unknown error (e.g. unique constraint violation from prisma)
    throw err;
  }
}

export async function removeMemberFromOrg(
  db: PrismaClient,
  orgId: string,
  userId: string,
): Promise<{ success: boolean }> {
  await removeMember(db, orgId, userId);
  return { success: true };
}
