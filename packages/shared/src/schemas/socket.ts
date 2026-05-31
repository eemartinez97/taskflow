import z from "zod";
import { taskSchema } from "./task";
import { colorSchema, idSchema } from "./common";
import { commentSchema } from "./comment";
import { userSchema } from "./user";

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
