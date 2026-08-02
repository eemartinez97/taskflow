import { updateUserSchema } from "@taskflow/shared";
import { createTRPCRouter } from "../../trpc/init";
import { protectedProcedure } from "../../trpc/procedures";
import { getMe, signOutUser, updateMyProfile } from "./service";

export const authRouter = createTRPCRouter({
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
    .mutation(async ({ ctx, input }) => updateMyProfile(ctx.db, ctx.user.id, input)),
});
