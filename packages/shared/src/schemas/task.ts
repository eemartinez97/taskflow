import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "../constants";
import { idSchema } from "./common";

export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export const taskStatusSchema = z.enum(TASK_STATUSES);

export const taskSchema = z.object({
  id: idSchema,
  columnId: idSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(10_000).nullable(),
  assigneeId: idSchema.nullable(),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  // Fractional float for 0(1) lexorank-style reordering
  position: z.number(),
  dueDate: z.date().nullable(),
  // Nullable: the creator account may have been deleted. Mirrors the Prisma
  // `Task.creatorId` column so `SocketTask` stays structurally equal to `Task`.
  creatorId: idSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createTaskSchema = taskSchema
  .pick({
    columnId: true,
    title: true,
  })
  .extend({
    description: z.string().max(10_000).optional(),
    assigneeId: idSchema.optional(),
    priority: taskPrioritySchema.default("NONE"),
    dueDate: z.date().optional(),
  });

// status is deliberately absent - it's fully derived server-side from the
// task's column (Column.mappedStatus), never client-settable. See
// tasks/service.ts's createTaskInColumn/moveTaskToColumn.
export const updateTaskSchema = createTaskSchema
  .omit({ columnId: true })
  .extend({
    priority: taskPrioritySchema.optional(),
    assigneeId: idSchema.nullable().optional(),
    description: z.string().max(10_000).nullable().optional(),
    dueDate: z.date().nullable().optional(),
  })
  .partial();

export const moveTaskSchema = z.object({
  taskId: idSchema,
  targetColumnId: idSchema,
  position: z.number(),
});
