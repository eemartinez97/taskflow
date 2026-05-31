import z from "zod";
import { idSchema } from "./common";

export const columnSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  name: z.string().min(1).max(100),
  position: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const boardSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string().min(1).max(100),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  projectId: idSchema,
});

export const updateBoardSchema = createBoardSchema.partial();

export const createColumnSchema = z.object({
  name: z.string().min(1).max(100),
  boardId: idSchema,
  position: z.number().optional(),
});

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
