import { describe, expect, it } from "vitest";

import {
  attachLabelToTask,
  bulkSetTaskStatusForColumn,
  createTask,
  deleteTask,
  detachLabelFromTask,
  findLabelsByTask,
  findTaskById,
  findTaskByUser,
  findTaskLabelsByProject,
  findTasksByColumn,
  getMaxTaskPosition,
  moveTask,
  updateTask,
} from "../../../../src/modules/tasks/repo";
import { buildLabel, buildTask } from "../../../factories";
import {
  db,
  VALID_COLUMN_ID,
  VALID_LABEL_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

const task = buildTask();
const label = buildLabel();

describe("tasks repo", () => {
  itDelegatesToPrisma([
    {
      name: "findTasksByColumn orders by position",
      delegate: mockDb.task.findMany,
      resolves: [task],
      call: () => findTasksByColumn(db, VALID_COLUMN_ID),
      args: { where: { columnId: VALID_COLUMN_ID }, orderBy: { position: "asc" } },
    },
    {
      name: "findTaskById",
      delegate: mockDb.task.findUnique,
      resolves: task,
      call: () => findTaskById(db, VALID_TASK_ID),
      args: { where: { id: VALID_TASK_ID } },
    },
    {
      name: "createTask strips undefined",
      delegate: mockDb.task.create,
      resolves: task,
      call: () =>
        createTask(db, {
          columnId: VALID_COLUMN_ID,
          title: "Ship",
          description: undefined,
          position: 1000,
          priority: "LOW",
          creatorId: VALID_USER.id,
        }),
      args: {
        data: {
          columnId: VALID_COLUMN_ID,
          title: "Ship",
          position: 1000,
          creatorId: VALID_USER.id,
          priority: "LOW",
        },
      },
    },
    {
      name: "updateTask strips undefined",
      delegate: mockDb.task.update,
      resolves: task,
      call: () => updateTask(db, VALID_TASK_ID, { title: "New", assigneeId: undefined }),
      args: { where: { id: VALID_TASK_ID }, data: { title: "New" } },
    },
    {
      name: "deleteTask",
      delegate: mockDb.task.delete,
      resolves: task,
      call: () => deleteTask(db, VALID_TASK_ID),
      args: { where: { id: VALID_TASK_ID } },
      returns: undefined,
    },
    {
      name: "findLabelsByTask",
      delegate: mockDb.label.findMany,
      resolves: [label],
      call: () => findLabelsByTask(db, VALID_TASK_ID),
      args: { where: { tasks: { some: { taskId: VALID_TASK_ID } } }, orderBy: { name: "asc" } },
    },
    {
      name: "attachLabelToTask is idempotent (upsert on the composite PK)",
      delegate: mockDb.taskLabel.upsert,
      resolves: {},
      call: () => attachLabelToTask(db, VALID_TASK_ID, VALID_LABEL_ID),
      args: {
        where: { taskId_labelId: { taskId: VALID_TASK_ID, labelId: VALID_LABEL_ID } },
        create: { taskId: VALID_TASK_ID, labelId: VALID_LABEL_ID },
        update: {},
      },
      returns: undefined,
    },
    {
      name: "detachLabelFromTask never throws when absent (deleteMany)",
      delegate: mockDb.taskLabel.deleteMany,
      resolves: { count: 0 },
      call: () => detachLabelFromTask(db, VALID_TASK_ID, VALID_LABEL_ID),
      args: { where: { taskId: VALID_TASK_ID, labelId: VALID_LABEL_ID } },
      returns: undefined,
    },
  ]);
});

describe("moveTask", () => {
  it("writes only columnId/position when no status is given, and reports statusChanged: false", async () => {
    mockDb.task.update.mockResolvedValueOnce(task);
    mockDb.task.findUniqueOrThrow.mockResolvedValueOnce(task);

    const result = await moveTask(db, {
      taskId: VALID_TASK_ID,
      targetColumnId: "col-2",
      position: 1500,
    });

    expect(mockDb.task.updateMany).not.toHaveBeenCalled();
    expect(mockDb.task.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: VALID_TASK_ID },
      data: { columnId: "col-2", position: 1500 },
    });
    expect(result).toEqual({ task, statusChanged: false });
  });

  it("writes status via a conditional updateMany and reports statusChanged: true when it actually changed", async () => {
    mockDb.task.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.task.findUniqueOrThrow.mockResolvedValueOnce({ ...task, status: "DONE" });

    const result = await moveTask(db, {
      taskId: VALID_TASK_ID,
      targetColumnId: "col-2",
      position: 1500,
      status: "DONE",
    });

    expect(mockDb.task.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: VALID_TASK_ID, status: { not: "DONE" } },
      data: { columnId: "col-2", position: 1500, status: "DONE" },
    });
    expect(mockDb.task.update).not.toHaveBeenCalled();
    expect(result).toEqual({ task: { ...task, status: "DONE" }, statusChanged: true });
  });

  it("falls back to a plain update when the task's status already matched the target", async () => {
    mockDb.task.updateMany.mockResolvedValueOnce({ count: 0 });
    mockDb.task.update.mockResolvedValueOnce(task);
    mockDb.task.findUniqueOrThrow.mockResolvedValueOnce(task);

    const result = await moveTask(db, {
      taskId: VALID_TASK_ID,
      targetColumnId: "col-2",
      position: 1500,
      status: "DONE",
    });

    expect(mockDb.task.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: VALID_TASK_ID },
      data: { columnId: "col-2", position: 1500, status: "DONE" },
    });
    expect(result).toEqual({ task, statusChanged: false });
  });
});

describe("bulkSetTaskStatusForColumn", () => {
  it("returns [] and skips the write when every task already has the target status", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([]);

    const result = await bulkSetTaskStatusForColumn(db, VALID_COLUMN_ID, "DONE");

    expect(mockDb.task.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { columnId: VALID_COLUMN_ID, status: { not: "DONE" } },
      select: { id: true },
    });
    expect(mockDb.task.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns the ids actually changed, and writes only those rows", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([{ id: "task-1" }, { id: "task-2" }]);
    mockDb.task.updateMany.mockResolvedValueOnce({ count: 2 });

    const result = await bulkSetTaskStatusForColumn(db, VALID_COLUMN_ID, "DONE");

    expect(mockDb.task.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { columnId: VALID_COLUMN_ID, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
    expect(result).toEqual(["task-1", "task-2"]);
  });
});

describe("getMaxTaskPosition", () => {
  it.each([
    ["steps from the last task", { position: 2000 }, 3000],
    ["starts at POSITION_STEP in an empty column", null, 1000],
  ])("%s", async (_name, last, expected) => {
    mockDb.task.findFirst.mockResolvedValueOnce(last);

    await expect(getMaxTaskPosition(db, VALID_COLUMN_ID)).resolves.toBe(expected);
  });
});

describe("findTaskByUser", () => {
  it("flattens the column -> board -> project chain into projectId/orgId", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([
      {
        ...task,
        column: { board: { projectId: VALID_PROJECT_ID, project: { orgId: VALID_ORG_ID } } },
      },
    ]);

    const result = await findTaskByUser(db, VALID_USER.id);

    expect(result).toEqual([{ ...task, projectId: VALID_PROJECT_ID, orgId: VALID_ORG_ID }]);
    expect(result[0]).not.toHaveProperty("column");
  });

  it("returns an empty array when the user has no tasks", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([]);

    await expect(findTaskByUser(db, VALID_USER.id)).resolves.toEqual([]);
  });
});

describe("findTaskLabelsByProject", () => {
  it("returns flat (taskId, label) pairs", async () => {
    mockDb.taskLabel.findMany.mockResolvedValueOnce([
      { taskId: VALID_TASK_ID, labelId: VALID_LABEL_ID, label },
    ]);

    await expect(findTaskLabelsByProject(db, VALID_PROJECT_ID)).resolves.toEqual([
      { taskId: VALID_TASK_ID, label },
    ]);

    expect(mockDb.taskLabel.findMany).toHaveBeenCalledWith({
      where: { task: { column: { board: { projectId: VALID_PROJECT_ID } } } },
      include: { label: true },
    });
  });
});
