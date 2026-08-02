import { describe } from "vitest";

import {
  createComment,
  deleteComment,
  findCommentById,
  findCommentsByTask,
} from "../../../../src/modules/comments/repo";
import { buildComment, buildCommentWithAuthor } from "../../../factories";
import { commentWithAuthor } from "../../../mocks/database-mock";
import { db, VALID_COMMENT_ID, VALID_TASK_ID, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

describe("comments repo", () => {
  itDelegatesToPrisma([
    {
      name: "findCommentsByTask is chronological",
      delegate: mockDb.comment.findMany,
      resolves: [buildCommentWithAuthor()],
      call: () => findCommentsByTask(db, VALID_TASK_ID),
      args: {
        where: { taskId: VALID_TASK_ID },
        orderBy: { createdAt: "asc" },
        include: commentWithAuthor,
      },
    },
    {
      name: "findCommentById",
      delegate: mockDb.comment.findUnique,
      resolves: buildComment(),
      call: () => findCommentById(db, VALID_COMMENT_ID),
      args: { where: { id: VALID_COMMENT_ID } },
    },
    {
      name: "createComment includes the author",
      delegate: mockDb.comment.create,
      resolves: buildCommentWithAuthor(),
      call: () => createComment(db, VALID_TASK_ID, VALID_USER.id, "LGTM"),
      args: {
        data: { taskId: VALID_TASK_ID, authorId: VALID_USER.id, body: "LGTM" },
        include: commentWithAuthor,
      },
    },
    {
      name: "deleteComment",
      delegate: mockDb.comment.delete,
      resolves: buildComment(),
      call: () => deleteComment(db, VALID_COMMENT_ID),
      args: { where: { id: VALID_COMMENT_ID } },
      returns: undefined,
    },
  ]);
});
