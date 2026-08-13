import { z } from "zod";

import {
  createOrgSchema,
  idSchema,
  updateCursorPreferenceSchema,
  updateMemberRoleSchema,
  updateOrgSchema,
} from "@taskflow/shared";

import {
  createOrgForUser,
  deleteOrgById,
  leaveOrg,
  listFormerAssignees,
  listMembers,
  listOrgs,
  removeMemberFromOrg,
  updateCursorPreference,
  updateMemberRoleInOrg,
  updateOrgById,
} from "./service";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";
import type { AppServer } from "../../socket/events";

// Role guards - composed once, reused across procedures
const ownerProcedure = protectedProcedure.use(roleGuard(["OWNER"]));
const adminProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));
// All 4 roles - VIEWER included. Read-only: the Team page (formerly /organizations/[orgId])
// is reachable from the main nav now, so a VIEWER opening it must not hit FORBIDDEN.
const readerProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER", "VIEWER"]));

/**
 * Factory (not a static router object) because `leave` and `removeMember`
 * need `io` to notify the org's OWNER/ADMIN when a member departs - same
 * `createXRouter(io)` pattern as boards/tasks/comments/invitations.
 */
const _buildOrgsRouter = (io: AppServer) =>
  createTRPCRouter({
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

    /**
     * Self-scoped: writes only the caller's own membership row for `orgId`.
     * readerProcedure's roleGuard already proves the caller has SOME
     * membership in that org (any role) - there is no `userId` in the input,
     * so there is nothing else to authorize.
     */
    updateMyCursorPreference: readerProcedure
      .input(z.object({ orgId: idSchema }).extend(updateCursorPreferenceSchema.shape))
      .mutation(async ({ ctx, input }) => {
        return updateCursorPreference(ctx.db, input.orgId, ctx.user.id, input.cursorsHidden);
      }),

    /**
     * Users still assigned to a task in this org but no longer members - the
     * client merges this into its assigneeById map so a departed member's
     * name still resolves instead of every one of their tasks silently
     * rendering as unassigned. Read-only, all 4 roles.
     */
    formerAssignees: readerProcedure
      .input(z.object({ orgId: idSchema }))
      .query(async ({ ctx, input }) => {
        return listFormerAssignees(ctx.db, input.orgId);
      }),

    /** Removes a member from the org. OWNER cannot be removed. */
    removeMember: ownerProcedure
      .input(z.object({ orgId: idSchema, userId: idSchema }))
      .mutation(async ({ ctx, input }) => {
        return removeMemberFromOrg(ctx.db, io, input.orgId, input.userId);
      }),

    updateMemberRole: ownerProcedure
      .input(z.object({ orgId: idSchema, userId: idSchema, data: updateMemberRoleSchema }))
      .mutation(async ({ ctx, input }) =>
        updateMemberRoleInOrg(ctx.db, input.orgId, input.userId, input.data.role),
      ),

    /**
     * Self-scoped: the caller leaves their own membership. Same authorization
     * shape as updateMyCursorPreference - roleGuard proves membership, no
     * userId in the input to additionally authorize.
     */
    leave: readerProcedure.input(z.object({ orgId: idSchema })).mutation(async ({ ctx, input }) => {
      return leaveOrg(ctx.db, io, input.orgId, ctx.user.id);
    }),
  });

export type OrgsRouter = ReturnType<typeof _buildOrgsRouter>;

export function createOrgsRouter(io: AppServer): OrgsRouter {
  return _buildOrgsRouter(io);
}
