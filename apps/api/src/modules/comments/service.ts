import type { CommentWithAuthor, PrismaClient } from "@taskflow/database";
import { TRPCError } from "../../trpc/init";
import { createComment, deleteComment, findCommentById, findCommentsByTask } from "./repo";
import { notifyCommentCreated } from "../notifications/service";
import { emitToProject } from "../../socket/emit";
import { SOCKET_EVENTS } from "@taskflow/shared";
import type { AppServer } from "../../socket/events";
import { fireAndForget } from "../../utils/fire-and-forget";

/**
 * Fire-and-forget: notifyCommentCreated does its own DB write plus a
 * socket emit. Awaiting it before returning would delay the HTTP response
 * - which the comment form's disabled/loading state is bound to - behind
 * work the caller doesn't need to wait for, and would turn a failed
 * notification into a false failure of an already-successful comment.
 */
function notifyCommentCreatedInBackground(...args: Parameters<typeof notifyCommentCreated>): void {
  fireAndForget(notifyCommentCreated(...args), "comments: failed to notify", {
    taskId: args[2].taskId,
  });
}

export async function listComments(db: PrismaClient, taskId: string): Promise<CommentWithAuthor[]> {
  return findCommentsByTask(db, taskId);
}

export async function createCommentOnTask(
  db: PrismaClient,
  io: AppServer,
  projectId: string,
  taskId: string,
  authorId: string,
  body: string,
): Promise<CommentWithAuthor> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true, creatorId: true, title: true },
  });

  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });

  const comment = await createComment(db, taskId, authorId, body);

  emitToProject(io, projectId, SOCKET_EVENTS.COMMENT_CREATED, { comment }, authorId);

  notifyCommentCreatedInBackground(db, io, {
    taskId,
    taskTitle: task.title,
    assigneeId: task.assigneeId,
    creatorId: task.creatorId,
    actorId: authorId,
  });

  return comment;
}

export async function deleteCommentById(
  db: PrismaClient,
  io: AppServer,
  projectId: string,
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

  emitToProject(
    io,
    projectId,
    SOCKET_EVENTS.COMMENT_DELETED,
    { commentId, taskId: comment.taskId },
    requesterId,
  );

  return { success: true };
}
