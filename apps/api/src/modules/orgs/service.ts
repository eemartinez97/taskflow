import type {
  Membership,
  MembershipWithUser,
  Org,
  OrgWithMembership,
  PrismaClient,
  Role,
} from "@taskflow/database";
import type { CreateOrg, InviteMember, UpdateOrg } from "@taskflow/shared";

import {
  createOrg,
  deleteOrg,
  findMembers,
  findMembership,
  findOrgById,
  findOrgsByUser,
  inviteMember,
  removeMember,
  updateMembershipRole,
  updateOrg,
  UserNotFoundError,
} from "./repo";
import { notifyMemberInvited } from "../notifications/service";
import { TRPCError } from "../../trpc/init";
import type { AppServer } from "../../socket/events";

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

export async function inviteMemberToOrg(
  db: PrismaClient,
  io: AppServer,
  orgId: string,
  actorId: string,
  data: InviteMember,
): Promise<Membership> {
  try {
    const membership = await inviteMember(db, orgId, data);

    const org = await findOrgById(db, orgId);
    await notifyMemberInvited(db, io, {
      recipientId: membership.userId,
      actorId,
      orgId,
      orgName: org?.name ?? "",
    });

    return membership;
  } catch (err) {
    if (err instanceof UserNotFoundError) {
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
