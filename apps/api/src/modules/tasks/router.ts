import { z } from "zod";
import { createTaskSchema, idSchema, moveTaskSchema, updateTaskSchema } from "@taskflow/shared";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";
import {
  addLabelToTaskById,
  createTaskInColumn,
  deleteTaskById,
  getMyTasks,
  getTask,
  listProjectTaskLabels,
  listTaskLabels,
  listTasks,
  moveTaskToColumn,
  removeLabelFromTaskById,
  updateTaskById,
} from "./service";
import type { AppServer } from "../../socket/events";

const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));

/**
 * Factory so the router can receive the Socket.IO server at construction time
 * instead of importing a module-level singleton (improves testability)
 *
 * Private builder - captures the full inferred Router type so the exported
 * factory function can declare an explicit return type via ReturnType<>.
 *
 * WHY a separate private function:
 * tRPC router return types are deeply inferred generics that cannot be written
 * by hand. `ReturnType<typeof _buildTasksRouter>` lets TypeScript resolve the
 * type once and reuse it, satisfying @typescript-eslint/explicit-module-boundary-types
 * without losing any type information.
 */
const _buildTasksRouter = (io: AppServer) =>
  createTRPCRouter({
    list: memberProcedure
      .input(z.object({ orgId: idSchema, columnId: idSchema }))
      .query(async ({ ctx, input }) => listTasks(ctx.db, input.columnId)),

    get: memberProcedure
      .input(z.object({ orgId: idSchema, taskId: idSchema }))
      .query(async ({ ctx, input }) => getTask(ctx.db, input.taskId)),

    myTasks: protectedProcedure.query(async ({ ctx }) => getMyTasks(ctx.db, ctx.user.id)),

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

    // -- labels --
    labels: memberProcedure
      .input(z.object({ orgId: idSchema, taskId: idSchema }))
      .query(async ({ ctx, input }) => listTaskLabels(ctx.db, input.taskId)),

    labelsByProject: memberProcedure
      .input(z.object({ orgId: idSchema, projectId: idSchema }))
      .query(async ({ ctx, input }) => listProjectTaskLabels(ctx.db, input.projectId)),

    addLabel: memberProcedure
      .input(
        z.object({ orgId: idSchema, projectId: idSchema, taskId: idSchema, labelId: idSchema }),
      )
      .mutation(async ({ ctx, input }) => addLabelToTaskById(ctx.db, io, input)),

    removeLabel: memberProcedure
      .input(
        z.object({ orgId: idSchema, projectId: idSchema, taskId: idSchema, labelId: idSchema }),
      )
      .mutation(async ({ ctx, input }) => removeLabelFromTaskById(ctx.db, io, input)),
  });

/** Inferred Router type - used by createAppRouter for the `tasks` key. */
export type TaskRouter = ReturnType<typeof _buildTasksRouter>;

/** Factory that injects the Socket.IO server into all task mutations. */
export function createTasksRouter(io: AppServer): TaskRouter {
  return _buildTasksRouter(io);
}
