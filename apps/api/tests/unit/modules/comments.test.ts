import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env.js");

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init.js";
import { createCommentsRouter } from "../../../src/modules/comments/router.js";
import { mockEmit, mockIo, mockTo } from "../../mocks/socket.js";
import {
  ANOTHER_UUID,
  FIXED_DATE,
  makeCtx,
  VALID_COMMENT_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../helpers.js";
import { mockDb } from "../../mocks/database-mock.js";
import { SOCKET_EVENTS } from "@taskflow/shared";

const caller = createCallerFactory(createTRPCRouter({ comments: createCommentsRouter(mockIo) }));
const authed = () => caller(makeCtx(VALID_USER));

const mockComment = {
  id: VALID_COMMENT_ID,
  taskId: VALID_TASK_ID,
  authorId: VALID_USER.id,
  body: "LGTM!",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

describe("comments.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns comments for the task", async () => {
    mockDb.comment.findMany.mockResolvedValueOnce([mockComment]);
    const result = await authed().comments.list({ taskId: VALID_TASK_ID });
    expect(result).toHaveLength(1);
    expect(result[0]?.body).toBe("LGTM!");
  });
});

describe("comments.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates comment and emits comment:created", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.comment.create.mockResolvedValueOnce(mockComment);

    const result = await authed().comments.create({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      taskId: VALID_TASK_ID,
      body: "LGTM!",
    });

    expect(result.body).toBe("LGTM!");
    expect(mockTo).toHaveBeenCalledWith(`project:${VALID_PROJECT_ID}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.COMMENT_CREATED, { comment: mockComment });
  });

  it("rejects empty body", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });

    await expect(
      authed().comments.create({
        orgId: VALID_ORG_ID,
        projectId: VALID_PROJECT_ID,
        taskId: VALID_TASK_ID,
        body: "",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("comments.delete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes own comment successfully", async () => {
    mockDb.comment.findUnique.mockResolvedValueOnce(mockComment);
    mockDb.comment.delete.mockResolvedValueOnce(mockComment);

    expect(await authed().comments.delete({ commentId: VALID_COMMENT_ID })).toEqual({
      success: true,
    });
  });

  it("throws FORBIDDEN when deleting another user's comment", async () => {
    mockDb.comment.findUnique.mockResolvedValueOnce({
      ...mockComment,
      authorId: ANOTHER_UUID, // different author
    });

    await expect(authed().comments.delete({ commentId: VALID_COMMENT_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws NOT_FOUND when comment does not exist", async () => {
    mockDb.comment.findUnique.mockResolvedValueOnce(null);

    await expect(authed().comments.delete({ commentId: VALID_COMMENT_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
