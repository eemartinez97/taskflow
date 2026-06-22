import type { Comment, PrismaClient } from "@taskflow/database";

export async function findCommentsByTask(db: PrismaClient, taskId: string): Promise<Comment[]> {
  return db.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

export async function findCommentById(
  db: PrismaClient,
  commentId: string,
): Promise<Comment | null> {
  return db.comment.findUnique({ where: { id: commentId } });
}

export async function createComment(
  db: PrismaClient,
  taskId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  return db.comment.create({ data: { taskId, authorId, body } });
}

export async function deleteComment(db: PrismaClient, commentId: string): Promise<void> {
  await db.comment.delete({ where: { id: commentId } });
}
