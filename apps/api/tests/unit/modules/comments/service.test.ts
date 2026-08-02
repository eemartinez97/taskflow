import { describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";

import {
  createCommentOnTask,
  deleteCommentById,
  listComments,
} from "../../../../src/modules/comments/service";
import { buildComment, buildCommentWithAuthor } from "../../../factories";
import {
  ANOTHER_UUID,
  db,
  VALID_COMMENT_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import { expectEmittedToProject } from "../../../support/socket-assert";

const comment = buildCommentWithAuthor();

describe("listComments", () => {
  it("returns the task's comments", async () => {
    mockDb.comment.findMany.mockResolvedValueOnce([comment]);

    await expect(listComments(db, VALID_TASK_ID)).resolves.toEqual([comment]);
  });
});

describe("createCommentOnTask", () => {
  it("creates, broadcasts and notifies the assignee", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce({
      assigneeId: ANOTHER_UUID,
      title: "Ship it",
    });
    mockDb.comment.create.mockResolvedValueOnce(comment);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await expect(
      createCommentOnTask(db, mockIo, VALID_PROJECT_ID, VALID_TASK_ID, VALID_USER.id, "LGTM"),
    ).resolves.toBe(comment);

    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.COMMENT_CREATED, { comment });
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "COMMENT_CREATED",
          message: 'Alice commented on "Ship it"',
        }) as unknown,
      }),
    );
  });

  it("does not notify when the task has no assignee", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce({ assigneeId: null, title: "Ship it" });
    mockDb.comment.create.mockResolvedValueOnce(comment);

    await createCommentOnTask(db, mockIo, VALID_PROJECT_ID, VALID_TASK_ID, VALID_USER.id, "LGTM");

    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("does not notify the author when they comment on their own task", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce({ assigneeId: VALID_USER.id, title: "Mine" });
    mockDb.comment.create.mockResolvedValueOnce(comment);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });

    await createCommentOnTask(
      db,
      mockIo,
      VALID_PROJECT_ID,
      VALID_TASK_ID,
      VALID_USER.id,
      "note to self",
    );

    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND before creating anything when the task is gone", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);
    await expect(
      createCommentOnTask(db, mockIo, VALID_PROJECT_ID, VALID_TASK_ID, VALID_USER.id, "hi"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.comment.create).not.toHaveBeenCalled();
  });
});

describe("deleteCommentById", () => {
  it("throws NOT_FOUND for an unknown comment", async () => {
    mockDb.comment.findUnique.mockResolvedValueOnce(null);

    await expect(
      deleteCommentById(db, mockIo, VALID_PROJECT_ID, VALID_COMMENT_ID, VALID_USER.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only the author can delete their comment", async () => {
    mockDb.comment.findUnique.mockResolvedValueOnce(buildComment({ authorId: ANOTHER_UUID }));

    await expect(
      deleteCommentById(db, mockIo, VALID_PROJECT_ID, VALID_COMMENT_ID, VALID_USER.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockDb.comment.delete).not.toHaveBeenCalled();
  });

  it("deletes and broadcasts comment:deleted with the parent taskId", async () => {
    mockDb.comment.findUnique.mockResolvedValueOnce(buildComment());

    await expect(
      deleteCommentById(db, mockIo, VALID_PROJECT_ID, VALID_COMMENT_ID, VALID_USER.id),
    ).resolves.toEqual({ success: true });

    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.COMMENT_DELETED, {
      commentId: VALID_COMMENT_ID,
      taskId: VALID_TASK_ID,
    });
  });
});
