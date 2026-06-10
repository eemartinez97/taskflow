import { z } from "zod";
import { idSchema } from "./common.js";

export const commentSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  authorId: idSchema,
  body: z.string().min(1).max(5000),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createCommentSchema = z.object({
  taskId: idSchema,
  body: z.string().min(1).max(5000),
});
