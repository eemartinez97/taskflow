import { z } from "zod";

import {
  createOrgSchema,
  idSchema,
  updateMemberRoleSchema,
  updateOrgSchema,
} from "@taskflow/shared";

import {
  createOrgForUser,
  deleteOrgById,
  listMembers,
  listOrgs,
  removeMemberFromOrg,
  updateMemberRoleInOrg,
  updateOrgById,
} from "./service";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";

// Role guards - composed once, reused across procedures
const ownerProcedure = protectedProcedure.use(roleGuard(["OWNER"]));
const adminProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));
// All 4 roles - VIEWER included. Read-only: the Team page (formerly /organizations/[orgId])
// is reachable from the main nav now, so a VIEWER opening it must not hit FORBIDDEN.
const readerProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER", "VIEWER"]));

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

  /** Lists all members of an org. Read-only, so every role including VIEWER can call it. */
  members: readerProcedure.input(z.object({ orgId: idSchema })).query(async ({ ctx, input }) => {
    return listMembers(ctx.db, input.orgId);
  }),

  /** Removes a member from the org. OWNER cannot be removed. */
  removeMember: ownerProcedure
    .input(z.object({ orgId: idSchema, userId: idSchema }))
    .mutation(async ({ ctx, input }) => {
      return removeMemberFromOrg(ctx.db, input.orgId, input.userId);
    }),

  updateMemberRole: ownerProcedure
    .input(z.object({ orgId: idSchema, userId: idSchema, data: updateMemberRoleSchema }))
    .mutation(async ({ ctx, input }) =>
      updateMemberRoleInOrg(ctx.db, input.orgId, input.userId, input.data.role),
    ),
});
