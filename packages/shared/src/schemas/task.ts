import z from "zod";
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
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createTaskSchema = z.object({
  columnId: idSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(10_000).optional(),
  assigneeId: idSchema.optional(),
  priority: taskPrioritySchema.default("NONE"),
  dueDate: z.date().optional(),
});

export const updateTaskSchema = createTaskSchema
  .omit({ columnId: true, priority: true })
  .extend({
    priority: taskPrioritySchema.optional(),
    assigneeId: idSchema.nullable().optional(),
    status: taskStatusSchema.optional(),
    dueDate: z.date().nullable().optional(),
  })
  .partial();

export const moveTaskSchema = z.object({
  taskId: idSchema,
  targetColumnId: idSchema,
  position: z.number(),
});
