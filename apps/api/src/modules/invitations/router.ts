import {
  idSchema,
  inviteMemberSchema,
  invitationRefSchema,
  invitationTokenSchema,
} from "@taskflow/shared";
import { z } from "zod";

import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  getInvitationPreviewByToken,
  getInvitationPublicPreviewByToken,
  listInvitationsForOrg,
  listMyInvitations,
  resendInvitation,
  revokeInvitation,
} from "./service";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  roleGuard,
} from "../../trpc/procedures";
import type { AppServer } from "../../socket/events";

const adminProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));

/**
 * A separate module from modules/orgs: half these procedures are self-scoped
 * (no orgId in their input, so roleGuard can't apply) - interleaving guarded
 * admin procedures with unguarded invitee-facing ones would make an
 * accidentally-open one easy to miss in review.
 */
const _buildInvitationsRouter = (io: AppServer) =>
  createTRPCRouter({
    /** Invites someone to the org by email. Admin/owner only. */
    create: adminProcedure
      .input(z.object({ orgId: idSchema, data: inviteMemberSchema }))
      .mutation(async ({ ctx, input }) =>
        createInvitation(ctx.db, io, input.orgId, ctx.user.id, ctx.user.email, input.data),
      ),

    /** Lists every invitation (any status) for an org, newest first. */
    listForOrg: adminProcedure
      .input(z.object({ orgId: idSchema }))
      .query(async ({ ctx, input }) => listInvitationsForOrg(ctx.db, input.orgId)),

    /** Revokes a still-pending invitation. */
    revoke: adminProcedure
      .input(z.object({ orgId: idSchema, invitationId: idSchema }))
      .mutation(async ({ ctx, input }) =>
        revokeInvitation(ctx.db, io, input.invitationId, input.orgId, ctx.user.id),
      ),

    /** Re-sends a still-pending invitation with a fresh token. */
    resend: adminProcedure
      .input(z.object({ orgId: idSchema, invitationId: idSchema }))
      .mutation(async ({ ctx, input }) =>
        resendInvitation(ctx.db, input.invitationId, ctx.user.id),
      ),

    /** The signed-in user's own pending invitations - self-scoped by session email. */
    listMine: protectedProcedure.query(async ({ ctx }) =>
      listMyInvitations(ctx.db, ctx.user.email),
    ),

    /** Resolves an invitation by token for the signed-in viewer. */
    getByToken: protectedProcedure
      .input(invitationTokenSchema)
      .query(async ({ ctx, input }) =>
        getInvitationPreviewByToken(ctx.db, input.token, ctx.user.email),
      ),

    /** Minimal, unauthenticated preview - prefills the /register?invite= form. */
    getByTokenPublic: publicProcedure
      .input(invitationTokenSchema)
      .query(async ({ ctx, input }) => getInvitationPublicPreviewByToken(ctx.db, input.token)),

    /** Accepts an invitation by id or token. */
    accept: protectedProcedure
      .input(invitationRefSchema)
      .mutation(async ({ ctx, input }) => acceptInvitation(ctx.db, io, ctx.user, input)),

    /** Declines an invitation by id or token. */
    decline: protectedProcedure
      .input(invitationRefSchema)
      .mutation(async ({ ctx, input }) => declineInvitation(ctx.db, io, ctx.user, input)),
  });

export type InvitationsRouter = ReturnType<typeof _buildInvitationsRouter>;

export function createInvitationsRouter(io: AppServer): InvitationsRouter {
  return _buildInvitationsRouter(io);
}
