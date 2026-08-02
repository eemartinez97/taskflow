import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCommentsRouter } from "../../../../src/modules/comments/router";
import * as service from "../../../../src/modules/comments/service";
import {
  db,
  VALID_COMMENT_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../../helpers";
import { mockIo } from "../../../mocks/socket";
import { callerFor, expectTRPCError, grantRole } from "../../../support/trpc";
import { mockDb } from "../../../mocks/database-mock";
import { TENANT } from "../../../support/tenancy-fixtures";

vi.mock("../../../../src/modules/comments/service");

const router = createCommentsRouter(mockIo);
const caller = () => callerFor(router);

describe("comments router", () => {
  beforeEach(() => {
    grantRole("MEMBER");
    mockDb.project.findUnique.mockResolvedValue(TENANT.project); // create, delete
    mockDb.task.findUnique.mockResolvedValue(TENANT.task); // list
  });

  it("list -> listComments", async () => {
    await caller().list({ orgId: VALID_ORG_ID, taskId: VALID_TASK_ID });

    expect(service.listComments).toHaveBeenCalledWith(db, VALID_TASK_ID);
  });

  it("create -> createCommentOnTask", async () => {
    await caller().create({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      taskId: VALID_TASK_ID,
      body: "LGTM",
    });

    expect(service.createCommentOnTask).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_PROJECT_ID,
      VALID_TASK_ID,
      VALID_USER.id,
      "LGTM",
    );
  });

  it("delete -> deleteCommentById with the requester id", async () => {
    await caller().delete({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      commentId: VALID_COMMENT_ID,
    });

    expect(service.deleteCommentById).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_PROJECT_ID,
      VALID_COMMENT_ID,
      VALID_USER.id,
    );
  });

  it.each([
    ["empty body", ""],
    ["body over 5000 chars", "x".repeat(5001)],
  ])("rejects %s", async (_name, body) => {
    await expect(
      caller().create({
        orgId: VALID_ORG_ID,
        projectId: VALID_PROJECT_ID,
        taskId: VALID_TASK_ID,
        body,
      }),
    ).rejects.toThrow();
  });

  it("create requires at least MEMBER", async () => {
    grantRole("VIEWER");

    await expectTRPCError(
      caller().create({
        orgId: VALID_ORG_ID,
        projectId: VALID_PROJECT_ID,
        taskId: VALID_TASK_ID,
        body: "hi",
      }),
      "FORBIDDEN",
    );
  });
});
