import type { Server } from "socket.io";
import type { Comment, PrismaClient } from "@taskflow/database";
import { SOCKET_EVENTS, SOCKET_ROOM_PREFIX } from "@taskflow/shared";
import { TRPCError } from "../../trpc/init";
import { createComment, deleteComment, findCommentById, findCommentsByTask } from "./repo";
import { notifyCommentCreated } from "../notifications/service";

export async function listComments(db: PrismaClient, taskId: string): Promise<Comment[]> {
  return findCommentsByTask(db, taskId);
}

export async function createCommentOnTask(
  db: PrismaClient,
  io: Server,
  projectId: string,
  taskId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  const comment = await createComment(db, taskId, authorId, body);

  io.to(`${SOCKET_ROOM_PREFIX}${projectId}`).emit(SOCKET_EVENTS.COMMENT_CREATED, { comment });

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true, title: true },
  });

  await notifyCommentCreated(db, {
    taskId,
    taskTitle: task?.title ?? "",
    assigneeId: task?.assigneeId ?? null,
    actorId: authorId,
  });

  return comment;
}

export async function deleteCommentById(
  db: PrismaClient,
  commentId: string,
  requesterId: string,
): Promise<{ success: true }> {
  const comment = await findCommentById(db, commentId);

  if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found." });

  // Only the author can delete their own comment
  if (comment.authorId !== requesterId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own comments." });
  }

  await deleteComment(db, commentId);

  return { success: true };
}
