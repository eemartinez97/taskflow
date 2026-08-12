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
  createOrg,
  deleteOrg,
  findMembers,
  findMembership,
  findOrgById,
  findOrgsByUser,
  removeMember,
  updateMembershipRole,
  updateOrg,
} from "./repo";
import { TRPCError } from "../../trpc/init";

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

export async function removeMemberFromOrg(
  db: PrismaClient,
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

  await removeMember(db, orgId, userId);
  return { success: true };
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
