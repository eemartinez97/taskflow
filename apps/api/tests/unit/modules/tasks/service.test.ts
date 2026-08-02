import { describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";

import {
  addLabelToTaskById,
  createTaskInColumn,
  deleteTaskById,
  getMyTasks,
  getTask,
  listProjectTaskLabels,
  listTaskLabels,
  listTasks,
  moveTaskToColumn,
  removeLabelFromTaskById,
  updateTaskById,
} from "../../../../src/modules/tasks/service";
import { buildLabel, buildTask } from "../../../factories";
import {
  ANOTHER_UUID,
  db,
  VALID_COLUMN_ID,
  VALID_LABEL_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import { expectEmittedToProject, expectEmittedToUser } from "../../../support/socket-assert";

const task = buildTask();
const label = buildLabel();
const labelInput = {
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
  taskId: VALID_TASK_ID,
  labelId: VALID_LABEL_ID,
};

describe("read paths", () => {
  it("listTasks", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([task]);

    await expect(listTasks(db, VALID_COLUMN_ID)).resolves.toEqual([task]);
  });

  it("getTask returns the task", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);

    await expect(getTask(db, VALID_TASK_ID)).resolves.toBe(task);
  });

  it("getTask throws NOT_FOUND", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);

    await expect(getTask(db, VALID_TASK_ID)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getMyTasks flattens org/project ids", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([
      {
        ...task,
        column: { board: { projectId: VALID_PROJECT_ID, project: { orgId: VALID_ORG_ID } } },
      },
    ]);

    await expect(getMyTasks(db, VALID_USER.id)).resolves.toEqual([
      { ...task, projectId: VALID_PROJECT_ID, orgId: VALID_ORG_ID },
    ]);
  });

  it("listTaskLabels / listProjectTaskLabels", async () => {
    mockDb.label.findMany.mockResolvedValueOnce([label]);
    await expect(listTaskLabels(db, VALID_TASK_ID)).resolves.toEqual([label]);

    mockDb.taskLabel.findMany.mockResolvedValueOnce([{ taskId: VALID_TASK_ID, label }]);
    await expect(listProjectTaskLabels(db, VALID_PROJECT_ID)).resolves.toEqual([
      { taskId: VALID_TASK_ID, label },
    ]);
  });
});

describe("createTaskInColumn", () => {
  it("appends at the end of the column and broadcasts task:created", async () => {
    mockDb.task.findFirst.mockResolvedValueOnce({ position: 1000 });
    mockDb.task.create.mockResolvedValueOnce(task);

    await expect(
      createTaskInColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
        columnId: VALID_COLUMN_ID,
        title: "Ship",
        priority: "LOW",
      }),
    ).resolves.toBe(task);

    expect(mockDb.task.create).toHaveBeenCalledWith({
      data: {
        columnId: VALID_COLUMN_ID,
        title: "Ship",
        position: 2000,
        priority: "LOW",
        creatorId: VALID_USER.id,
      },
    });
    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.TASK_CREATED, { task });
  });

  it("skips the notification when there is no assignee", async () => {
    mockDb.task.findFirst.mockResolvedValueOnce(null);
    mockDb.task.create.mockResolvedValueOnce(task);

    await createTaskInColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
      columnId: VALID_COLUMN_ID,
      title: "Ship",
      priority: "LOW",
    });

    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("notifies the assignee when one is set", async () => {
    const assigned = buildTask({ assigneeId: ANOTHER_UUID });
    mockDb.task.findFirst.mockResolvedValueOnce(null);
    mockDb.task.create.mockResolvedValueOnce(assigned);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await createTaskInColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
      columnId: VALID_COLUMN_ID,
      title: "Ship it",
      assigneeId: ANOTHER_UUID,
      priority: "LOW",
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ANOTHER_UUID,
          type: "TASK_ASSIGNED",
          message: 'Alice assigned you to "Ship it"',
        }) as unknown,
      }),
    );
    expectEmittedToUser(ANOTHER_UUID, SOCKET_EVENTS.NOTIFICATION_CREATED, {
      notification: { id: "n1" },
    });
  });
});

describe("updateTaskById", () => {
  it("broadcasts task:updated", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);
    mockDb.task.update.mockResolvedValueOnce({ ...task, title: "New" });

    await updateTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID, {
      title: "New",
    });

    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.TASK_UPDATED, {
      task: { ...task, title: "New" },
    });
  });

  it.each([
    ["assigneeId is absent from the patch", {}, task],
    [
      "assigneeId is unchanged",
      { assigneeId: ANOTHER_UUID },
      buildTask({ assigneeId: ANOTHER_UUID }),
    ],
  ])("does not notify when %s", async (_name, patch, existing) => {
    mockDb.task.findUnique.mockResolvedValueOnce(existing);
    mockDb.task.update.mockResolvedValueOnce(existing);

    await updateTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID, patch);

    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("notifies only when the assignee actually changes", async () => {
    const updated = buildTask({ assigneeId: ANOTHER_UUID, title: "Ship it" });
    mockDb.task.findUnique.mockResolvedValueOnce(task); // assigneeId: null
    mockDb.task.update.mockResolvedValueOnce(updated);
    mockDb.user.findUnique.mockResolvedValueOnce({ name: null }); // actor deleted
    mockDb.notification.create.mockResolvedValueOnce({ id: "n1" });

    await updateTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID, {
      assigneeId: ANOTHER_UUID,
    });

    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: 'Someone assigned you to "Ship it"' }) as unknown,
      }),
    );
  });

  it("does not notify when the task is unassigned (assigneeId -> null)", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(buildTask({ assigneeId: ANOTHER_UUID }));
    mockDb.task.update.mockResolvedValueOnce(buildTask({ assigneeId: null }));

    await updateTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID, {
      assigneeId: null,
    });

    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND before writing when the task is gone", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID, { title: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.task.update).not.toHaveBeenCalled();
  });
});

describe("moveTaskToColumn / deleteTaskById", () => {
  it("moveTaskToColumn broadcasts task:moved", async () => {
    const moved = buildTask({ columnId: "col-2", position: 1500 });
    mockDb.task.update.mockResolvedValueOnce(moved);

    await expect(
      moveTaskToColumn(db, mockIo, VALID_PROJECT_ID, {
        taskId: VALID_TASK_ID,
        targetColumnId: "col-2",
        position: 1500,
      }),
    ).resolves.toBe(moved);

    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.TASK_MOVED, { task: moved });
  });

  it("deleteTaskById broadcasts task:deleted with just the id", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);

    await expect(deleteTaskById(db, mockIo, VALID_PROJECT_ID, VALID_TASK_ID)).resolves.toEqual({
      success: true,
    });

    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.TASK_DELETED, {
      taskId: VALID_TASK_ID,
    });
  });

  it("deleteTaskById throws NOT_FOUND without deleting", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);

    await expect(deleteTaskById(db, mockIo, VALID_PROJECT_ID, VALID_TASK_ID)).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    expect(mockDb.task.delete).not.toHaveBeenCalled();
  });
});

describe("addLabelToTaskById", () => {
  it("attaches and broadcasts the fresh label list", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);
    mockDb.label.findUnique.mockResolvedValueOnce({ orgId: VALID_ORG_ID });
    mockDb.label.findMany.mockResolvedValueOnce([label]);

    await expect(addLabelToTaskById(db, mockIo, labelInput)).resolves.toEqual([label]);

    expect(mockDb.taskLabel.upsert).toHaveBeenCalledOnce();
    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.TASK_LABELS_CHANGED, {
      taskId: VALID_TASK_ID,
      labels: [label],
    });
  });

  it("throws NOT_FOUND for an unknown task", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);

    await expect(addLabelToTaskById(db, mockIo, labelInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it.each([
    ["the label belongs to another org", { orgId: ANOTHER_UUID }],
    ["the label does not exist", null],
  ])("throws NOT_FOUND when %s", async (_name, labelRow) => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);
    mockDb.label.findUnique.mockResolvedValueOnce(labelRow);

    await expect(addLabelToTaskById(db, mockIo, labelInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDb.taskLabel.upsert).not.toHaveBeenCalled();
  });
});

describe("removeLabelFromTaskById", () => {
  it("detaches and broadcasts the remaining labels", async () => {
    mockDb.label.findMany.mockResolvedValueOnce([]);

    await expect(removeLabelFromTaskById(db, mockIo, labelInput)).resolves.toEqual([]);

    expect(mockDb.taskLabel.deleteMany).toHaveBeenCalledWith({
      where: { taskId: VALID_TASK_ID, labelId: VALID_LABEL_ID },
    });
    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.TASK_LABELS_CHANGED, {
      taskId: VALID_TASK_ID,
      labels: [],
    });
  });
});
