import { z } from "zod";
import {
  emailField,
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  updateUserSchema,
} from "@taskflow/shared";
import { createTRPCRouter } from "../../trpc/init";
import { internalProcedure, protectedProcedure, publicProcedure } from "../../trpc/procedures";
import type { AppServer } from "../../socket/events";

/** Shared by verifyEmail and checkResetToken below - both take a bare emailed token, nothing else. */
const tokenInputSchema = z.object({ token: z.string().min(1) });
import {
  checkResetToken,
  getMe,
  registerUser,
  requestPasswordReset,
  resetPassword,
  signOutUser,
  updateMyProfile,
  verifyCredentials,
  verifyEmail,
} from "./service";

/**
 * Factory (not a static router, like orgs/boards/tasks/comments): verifyEmail
 * needs `io` to claim any pending org invitations addressed to the
 * newly-verified email (see modules/invitations/service.ts's
 * claimInvitationsForUser), and updateProfile needs it to correct this
 * user's already-connected sockets/peers (see socket/presence.ts's
 * broadcastProfileNameUpdate).
 */
const _buildAuthRouter = (io: AppServer) =>
  createTRPCRouter({
    // -- Authenticated (protectedProcedure) --

    /** Returns the current authenticated user's profile */
    me: protectedProcedure.query(async ({ ctx }) => {
      return getMe(ctx.db, ctx.user.id);
    }),

    /** Invalidates all server-side sessions for the current user. */
    signOut: protectedProcedure.mutation(async ({ ctx }) => {
      return signOutUser(ctx.db, ctx.user.id);
    }),

    /** Updates the current user's own profile (name / avatar URL). */
    updateProfile: protectedProcedure
      .input(updateUserSchema)
      .mutation(async ({ ctx, input }) => updateMyProfile(ctx.db, io, ctx.user.id, input)),

    // -- Public (publicProcedure) - no session required --

    /** Creates (or resends the link for) an unverified account. */
    register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
      return registerUser(
        ctx.db,
        { name: input.name, email: input.email, password: input.password },
        ctx.clientIp,
        ctx.e2eSecretHeader,
      );
    }),

    /** Confirms an emailed verification link. */
    verifyEmail: publicProcedure
      .input(tokenInputSchema)
      .mutation(async ({ ctx, input }) => verifyEmail(ctx.db, io, input.token)),

    /** Always responds the same way, whether or not the email belongs to an account. */
    requestPasswordReset: publicProcedure
      .input(forgotPasswordSchema)
      .mutation(async ({ ctx, input }) =>
        requestPasswordReset(ctx.db, input, ctx.clientIp, ctx.e2eSecretHeader),
      ),

    /** Consumes a PASSWORD_RESET token and sets the new password. */
    resetPassword: publicProcedure.input(resetPasswordSchema).mutation(async ({ ctx, input }) => {
      return resetPassword(ctx.db, { token: input.token, password: input.password });
    }),

    /** Read-only pre-flight check for the /reset-password page's RSC gate. */
    checkResetToken: publicProcedure
      .input(tokenInputSchema)
      .query(async ({ ctx, input }) => checkResetToken(ctx.db, input.token)),

    // -- Internal (internalProcedure) - server-to-server only, never a browser --

    /**
     * Verifies email+password credentials for NextAuth's CredentialsProvider.
     * `clientIp` is the caller's own explicit forward of the real browser's
     * IP - see VerifyCredentialsInput's docblock in service.ts for why
     * `ctx.clientIp` isn't used here instead.
     */
    verifyCredentials: internalProcedure
      .input(
        z.object({
          email: emailField(),
          password: z.string().min(1),
          clientIp: z.string().nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => verifyCredentials(ctx.db, input, ctx.e2eSecretHeader)),
  });

export type AuthRouter = ReturnType<typeof _buildAuthRouter>;

export function createAuthRouter(io: AppServer): AuthRouter {
  return _buildAuthRouter(io);
}
