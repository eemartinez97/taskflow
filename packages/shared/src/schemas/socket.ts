import { z } from "zod";
import { taskSchema } from "./task";
import { colorSchema, idSchema } from "./common";
import { commentSchema } from "./comment";
import { userSchema } from "./user";

const taskPayloadSchema = z.object({ task: taskSchema });

// Typed payloads for all Socket.IO events (server -> client)
export const socketTaskCreatedSchema = taskPayloadSchema;
export const socketTaskUpdatedSchema = taskPayloadSchema;
export const socketTaskMovedSchema = taskPayloadSchema;
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
