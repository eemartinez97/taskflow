import { createOrgSchema, idSchema, inviteMemberSchema, updateOrgSchema } from "@taskflow/shared";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures.js";
import {
  createOrgForUser,
  deleteOrgById,
  inviteMemberToOrg,
  listMembers,
  listOrgs,
  removeMemberFromOrg,
  updateOrgById,
} from "./service.js";
import { z } from "zod";

// Role guards - composed once, reused across procedures
const ownerProcedure = protectedProcedure.use(roleGuard(["OWNER"]));
const adminProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));

export const orgsRouter = createTRPCRouter({
  /** Lists all orgs the current user is a member of. */
  list: protectedProcedure.query(async ({ ctx }) => {
    return listOrgs(ctx.db, ctx.user.id);
  }),

  /** Creates a new org. The creator is automatically set as OWNER */
  create: protectedProcedure.input(createOrgSchema).mutation(async ({ ctx, input }) => {
    return createOrgForUser(ctx.db, ctx.user.id, input);
  }),

  /** Updates org name or slug. Requires OWNER or ADMIN role. */
  update: adminProcedure
    .input(z.object({ orgId: idSchema, data: updateOrgSchema }))
    .mutation(async ({ ctx, input }) => {
      return updateOrgById(ctx.db, input.orgId, input.data);
    }),

  /** Permanently deletes an org and all its data. Requires OWNER. */
  delete: ownerProcedure.input(z.object({ orgId: idSchema })).mutation(async ({ ctx, input }) => {
    return deleteOrgById(ctx.db, input.orgId);
  }),

  /** Lists all members of an org. */
  members: protectedProcedure.input(z.object({ orgId: idSchema })).query(async ({ ctx, input }) => {
    return listMembers(ctx.db, input.orgId);
  }),

  /** Invites an existing TaskFlow user to the org by email. */
  invite: adminProcedure
    .input(z.object({ orgId: idSchema, data: inviteMemberSchema }))
    .mutation(async ({ ctx, input }) => {
      return inviteMemberToOrg(ctx.db, input.orgId, input.data);
    }),

  /** Removes a member from the org. OWNER cannot be removed. */
  removeMember: ownerProcedure
    .input(z.object({ orgId: idSchema, userId: idSchema }))
    .mutation(async ({ ctx, input }) => {
      return removeMemberFromOrg(ctx.db, input.orgId, input.userId);
    }),
});
