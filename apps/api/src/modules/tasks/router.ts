import { z } from "zod";
import type { Server } from "socket.io";
import { createTaskSchema, idSchema, moveTaskSchema, updateTaskSchema } from "@taskflow/shared";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures.js";
import {
  createTaskInColumn,
  deleteTaskById,
  getTask,
  listTasks,
  moveTaskToColumn,
  updateTaskById,
} from "./service.js";

const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));

/**
 * Factory so the router can receive the Socket.IO server at construction time
 * instead of importing a module-level singleton (improves testability)
 *
 * Private builder — captures the full inferred Router type so the exported
 * factory function can declare an explicit return type via ReturnType<>.
 *
 * WHY a separate private function:
 * tRPC router return types are deeply inferred generics that cannot be written
 * by hand. `ReturnType<typeof _buildTasksRouter>` lets TypeScript resolve the
 * type once and reuse it, satisfying @typescript-eslint/explicit-module-boundary-types
 * without losing any type information.
 */
const _buildTasksRouter = (io: Server) =>
  createTRPCRouter({
    list: memberProcedure
      .input(z.object({ orgId: idSchema, columnId: idSchema }))
      .query(async ({ ctx, input }) => listTasks(ctx.db, input.columnId)),

    get: protectedProcedure
      .input(z.object({ taskId: idSchema }))
      .query(async ({ ctx, input }) => getTask(ctx.db, input.taskId)),

    create: memberProcedure
      .input(z.object({ orgId: idSchema, projectId: idSchema, data: createTaskSchema }))
      .mutation(async ({ ctx, input }) =>
        createTaskInColumn(ctx.db, io, input.projectId, ctx.user.id, input.data),
      ),

    update: memberProcedure
      .input(
        z.object({
          orgId: idSchema,
          projectId: idSchema,
          taskId: idSchema,
          data: updateTaskSchema,
        }),
      )
      .mutation(async ({ ctx, input }) =>
        updateTaskById(ctx.db, io, input.projectId, ctx.user.id, input.taskId, input.data),
      ),

    move: memberProcedure
      .input(z.object({ orgId: idSchema, projectId: idSchema, payload: moveTaskSchema }))
      .mutation(async ({ ctx, input }) =>
        moveTaskToColumn(ctx.db, io, input.projectId, input.payload),
      ),

    delete: memberProcedure
      .input(z.object({ orgId: idSchema, projectId: idSchema, taskId: idSchema }))
      .mutation(async ({ ctx, input }) =>
        deleteTaskById(ctx.db, io, input.projectId, input.taskId),
      ),
  });

/** Inferred Router type - used by createAppRouter for the `tasks` key. */
export type TaskRouter = ReturnType<typeof _buildTasksRouter>;

/** Factory that injects the Socket.IO server into all task mutations. */
export function createTasksRouter(io: Server): TaskRouter {
  return _buildTasksRouter(io);
}
