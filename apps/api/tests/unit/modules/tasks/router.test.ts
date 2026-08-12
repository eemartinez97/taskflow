import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTasksRouter } from "../../../../src/modules/tasks/router";
import * as service from "../../../../src/modules/tasks/service";
import {
  db,
  VALID_COLUMN_ID,
  VALID_LABEL_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../../helpers";
import { mockIo } from "../../../mocks/socket";
import { callerFor, expectTRPCError, grantRole } from "../../../support/trpc";
import { mockDb } from "../../../mocks/database-mock";
import { TENANT } from "../../../support/tenancy-fixtures";

vi.mock("../../../../src/modules/tasks/service");

const router = createTasksRouter(mockIo);
const caller = () => callerFor(router);
const scope = { orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID };

describe("tasks router", () => {
  beforeEach(() => {
    grantRole("MEMBER");

    mockDb.project.findUnique.mockResolvedValue(TENANT.project);
    mockDb.column.findUnique.mockResolvedValue(TENANT.column);
    mockDb.task.findUnique.mockResolvedValue(TENANT.task);
    mockDb.label.findUnique.mockResolvedValue(TENANT.label);
  });

  it("list -> listTasks", async () => {
    await caller().list({ orgId: VALID_ORG_ID, columnId: VALID_COLUMN_ID });

    expect(service.listTasks).toHaveBeenCalledWith(db, VALID_COLUMN_ID);
  });

  it("get -> getTask", async () => {
    await caller().get({ orgId: VALID_ORG_ID, taskId: VALID_TASK_ID });

    expect(service.getTask).toHaveBeenCalledWith(db, VALID_TASK_ID);
  });

  it("myTasks -> getMyTasks(ctx.user.id)", async () => {
    await caller().myTasks();

    expect(service.getMyTasks).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("create -> createTaskInColumn with actor and io", async () => {
    const data = { columnId: VALID_COLUMN_ID, priority: "NONE" as const, title: "Ship" };

    await caller().create({ ...scope, data });

    expect(service.createTaskInColumn).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_PROJECT_ID,
      VALID_USER.id,
      data,
    );
  });

  it("update -> updateTaskById", async () => {
    await caller().update({ ...scope, taskId: VALID_TASK_ID, data: { title: "New" } });

    expect(service.updateTaskById).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_PROJECT_ID,
      VALID_USER.id,
      VALID_TASK_ID,
      { title: "New" },
    );
  });

  it("move -> moveTaskToColumn", async () => {
    const payload = { taskId: VALID_TASK_ID, targetColumnId: VALID_COLUMN_ID, position: 1500 };

    await caller().move({ ...scope, payload });

    expect(service.moveTaskToColumn).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_PROJECT_ID,
      VALID_USER.id,
      payload,
    );
  });

  it("delete -> deleteTaskById", async () => {
    await caller().delete({ ...scope, taskId: VALID_TASK_ID });

    expect(service.deleteTaskById).toHaveBeenCalledWith(
      db,
      mockIo,
      VALID_PROJECT_ID,
      VALID_USER.id,
      VALID_TASK_ID,
    );
  });

  it("labels -> listTaskLabels", async () => {
    await caller().labels({ orgId: VALID_ORG_ID, taskId: VALID_TASK_ID });

    expect(service.listTaskLabels).toHaveBeenCalledWith(db, VALID_TASK_ID);
  });

  it("labelsByProject -> listProjectTaskLabels", async () => {
    await caller().labelsByProject(scope);

    expect(service.listProjectTaskLabels).toHaveBeenCalledWith(db, VALID_PROJECT_ID);
  });

  it.each([
    ["addLabel", "addLabelToTaskById"],
    ["removeLabel", "removeLabelFromTaskById"],
  ] as const)("%s forwards the whole input object", async (procedure, fn) => {
    const input = { ...scope, taskId: VALID_TASK_ID, labelId: VALID_LABEL_ID };

    await caller()[procedure](input);

    expect(service[fn]).toHaveBeenCalledWith(db, mockIo, VALID_USER.id, input);
  });

  it("myTasks needs only a session, not a membership", async () => {
    await expectTRPCError(callerFor(router, null).myTasks(), "UNAUTHORIZED");
  });

  it("mutations require at least MEMBER", async () => {
    grantRole("VIEWER");

    await expectTRPCError(
      caller().create({ ...scope, data: { columnId: VALID_COLUMN_ID, title: "x" } }),
      "FORBIDDEN",
    );
  });

  it("rejects a non-uuid taskId", async () => {
    await expect(caller().get({ orgId: VALID_ORG_ID, taskId: "not-a-uuid" })).rejects.toThrow();
  });
});
