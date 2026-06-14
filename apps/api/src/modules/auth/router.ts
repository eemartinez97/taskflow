import { createTRPCRouter } from "../../trpc/init.js";
import { protectedProcedure } from "../../trpc/procedures.js";
import { getMe, signOutUser } from "./service.js";

export const authRouter = createTRPCRouter({
  /** Returns the current authenticated user's profile */
  me: protectedProcedure.query(async ({ ctx }) => {
    return getMe(ctx.db, ctx.user.id);
  }),

  /** Invalidates all server-side sessions for the current user. */
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    return signOutUser(ctx.db, ctx.user.id);
  }),
});
