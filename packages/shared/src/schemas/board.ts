import { z } from "zod";
import { idSchema } from "./common";
import { nameField } from "../utils/normalize";
import { taskStatusSchema } from "./task";

export const boardSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: nameField(1, 100),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createBoardSchema = boardSchema.pick({
  name: true,
  projectId: true,
});

export const updateBoardSchema = createBoardSchema.partial();

export const columnSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  name: nameField(1, 100),
  position: z.number(),
  // When set, creating/moving a task into this column auto-sets its status
  // to match - see setColumnStatusSchema below. Null means "no mapping",
  // i.e. a purely organizational column that never touches task status.
  mappedStatus: taskStatusSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createColumnSchema = columnSchema
  .pick({
    name: true,
    boardId: true,
  })
  .extend({ position: z.number().optional() });

export const updateColumnSchema = createColumnSchema.partial();

export const setColumnStatusSchema = z.object({
  columnId: idSchema,
  status: taskStatusSchema.nullable(),
});

export const reorderColumnsSchema = z.object({
  boardId: idSchema,
  // Array of {id, position } pairs for bulk reorder
  columns: z.array(
    z.object({
      id: idSchema,
      position: z.number(),
    }),
  ),
});
