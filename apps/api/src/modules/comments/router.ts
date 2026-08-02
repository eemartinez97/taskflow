import { z } from "zod";
import { idSchema } from "@taskflow/shared";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";
import { createCommentOnTask, deleteCommentById, listComments } from "./service";
import type { AppServer } from "../../socket/events";

const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));

const _buildCommentsRouter = (io: AppServer) =>
  createTRPCRouter({
    list: memberProcedure
      .input(z.object({ orgId: idSchema, taskId: idSchema }))
      .query(async ({ ctx, input }) => listComments(ctx.db, input.taskId)),

    create: memberProcedure
      .input(
        z.object({
          orgId: idSchema,
          projectId: idSchema,
          taskId: idSchema,
          body: z.string().min(1).max(5000),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        createCommentOnTask(ctx.db, io, input.projectId, input.taskId, ctx.user.id, input.body),
      ),

    delete: memberProcedure
      .input(z.object({ orgId: idSchema, projectId: idSchema, commentId: idSchema }))
      .mutation(async ({ ctx, input }) =>
        deleteCommentById(ctx.db, io, input.projectId, input.commentId, ctx.user.id),
      ),
  });

/** Inferred Router type - used by createAppRouter for the `comments` key. */
export type CommentRouter = ReturnType<typeof _buildCommentsRouter>;

/** Factory that injects the Socket.IO server into all task mutations. */
export function createCommentsRouter(io: AppServer): CommentRouter {
  return _buildCommentsRouter(io);
}
