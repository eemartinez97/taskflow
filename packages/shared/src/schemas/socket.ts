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
  /**
   * Column the cursor was captured over, when the pointer is inside a
   * column's own scrollable task list. Present -> (x, y) are relative to
   * that column's own content box (see use-cursor-broadcast.ts) so the
   * receiver can render the dot nested inside that same column's scroll
   * container and let the column's own vertical scroll reposition it
   * natively. Absent -> (x, y) are board-relative (pointer over the board
   * background/column header), rendered in the board-level overlay instead.
   */
  columnId: idSchema.optional(),
});
