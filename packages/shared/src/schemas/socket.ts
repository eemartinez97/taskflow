import { z } from "zod";
import { taskSchema } from "./task.js";
import { colorSchema, idSchema } from "./common.js";
import { commentSchema } from "./comment.js";
import { userSchema } from "./user.js";

// Typed payloads for all Socket.IO events (server -> client)
export const socketTaskCreatedSchema = z.object({ task: taskSchema });
export const socketTaskUpdatedSchema = z.object({ task: taskSchema });
export const socketTaskMovedSchema = z.object({ task: taskSchema });
export const socketTaskDeletedSchema = z.object({ taskId: idSchema });
export const socketCommentCreatedSchema = z.object({ comment: commentSchema });

// Presence events
export const presenceUserSchema = userSchema.pick({ name: true }).extend({
  userId: idSchema,
  // Assigned color for cursor/avatar display in the board
  color: colorSchema,
});

export const presenceCursorSchema = z.object({
  userId: idSchema,
  x: z.number(),
  y: z.number(),
});
