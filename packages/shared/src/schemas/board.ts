import { z } from "zod";
import { idSchema } from "./common";

export const boardSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string().min(1).max(100),
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
  name: z.string().min(1).max(100),
  position: z.number(),
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
