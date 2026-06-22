import { z } from "zod";
import { createTRPCRouter } from "../../trpc/init.js";
import { protectedProcedure } from "../../trpc/procedures.js";
import { deleteNotificationById, listNotifications, markAllRead, markReadById } from "./service.js";
import { idSchema } from "@taskflow/shared";

export const notificationsRouter = createTRPCRouter({
  /** Returns the 50 most recent notifications + unread count for the current user */
  list: protectedProcedure.query(async ({ ctx }) => listNotifications(ctx.db, ctx.user.id)),

  /** Marks specific notifications as read by id. */
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(idSchema).min(1) }))
    .mutation(async ({ ctx, input }) => markReadById(ctx.db, ctx.user.id, input.ids)),

  /** Marks ALL unread notifications as read in one operation. */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => markAllRead(ctx.db, ctx.user.id)),

  /** Deletes a single notification owned by the current user. */
  delete: protectedProcedure
    .input(z.object({ notificationId: idSchema }))
    .mutation(async ({ ctx, input }) =>
      deleteNotificationById(ctx.db, input.notificationId, ctx.user.id),
    ),
});
