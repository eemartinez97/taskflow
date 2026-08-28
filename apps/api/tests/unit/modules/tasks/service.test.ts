import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { appCollectors } from "../../../../src/metrics";
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
  beforeEach(() => {
    appCollectors.tasksCreatedTotal.reset();
  });

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
    expect((await appCollectors.tasksCreatedTotal.get()).values[0]?.value).toBe(1);
    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.TASK_CREATED, { task }, VALID_USER.id);
  });

  it("logs (does not throw) when notifying the assignee fails", async () => {
    mockDb.task.findFirst.mockResolvedValueOnce(null);
    mockDb.task.create.mockResolvedValueOnce(buildTask({ assigneeId: ANOTHER_UUID }));
    mockDb.user.findUnique.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(
      createTaskInColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
        columnId: VALID_COLUMN_ID,
        title: "Ship it",
        assigneeId: ANOTHER_UUID,
        priority: "LOW",
      }),
    ).resolves.toMatchObject({ assigneeId: ANOTHER_UUID });
    await new Promise((resolve) => setTimeout(resolve, 0));
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

    // notifyTaskAssigned now runs fire-and-forget (see tasks/service.ts) so
    // the response doesn't wait behind it - its own DB write/emit land on a
    // later microtask than this test's own `await` above resolves on.
    await vi.waitFor(() => {
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
});

describe("updateTaskById", () => {
  it("broadcasts task:updated", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);
    mockDb.task.update.mockResolvedValueOnce({ ...task, title: "New" });

    await updateTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID, {
      title: "New",
    });

    expectEmittedToProject(
      VALID_PROJECT_ID,
      SOCKET_EVENTS.TASK_UPDATED,
      { task: { ...task, title: "New" } },
      VALID_USER.id,
    );
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

    await vi.waitFor(() => {
      expect(mockDb.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Someone assigned you to "Ship it"',
          }) as unknown,
        }),
      );
    });
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
  beforeEach(() => {
    appCollectors.tasksDeletedTotal.reset();
    appCollectors.taskStatusChangesTotal.reset();
  });

  it("moveTaskToColumn broadcasts task:moved", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task); // pre-move, status: TODO
    mockDb.column.findUnique.mockResolvedValueOnce(null); // target column not found - no mapping
    const moved = buildTask({ columnId: "col-2", position: 1500 });
    mockDb.task.update.mockResolvedValueOnce(moved); // no status: undefined path
    mockDb.task.findUniqueOrThrow.mockResolvedValueOnce(moved);

    await expect(
      moveTaskToColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
        taskId: VALID_TASK_ID,
        targetColumnId: "col-2",
        position: 1500,
      }),
    ).resolves.toEqual(moved);

    expectEmittedToProject(
      VALID_PROJECT_ID,
      SOCKET_EVENTS.TASK_MOVED,
      { task: moved },
      VALID_USER.id,
    );
  });

  it("auto-sets status when moving into a column mapped to a status, and records the metric", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task); // pre-move, status: TODO
    mockDb.column.findUnique.mockResolvedValueOnce({
      id: "col-2",
      mappedStatus: "DONE",
    });
    const moved = buildTask({ columnId: "col-2", position: 1500, status: "DONE" });
    // status "DONE" differs from the row's real current status - the
    // conditional updateMany (moveTask's statusChanged detection) matches it.
    mockDb.task.updateMany.mockResolvedValueOnce({ count: 1 });
    mockDb.task.findUniqueOrThrow.mockResolvedValueOnce(moved);

    await moveTaskToColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
      taskId: VALID_TASK_ID,
      targetColumnId: "col-2",
      position: 1500,
    });

    expect(mockDb.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DONE" }) as unknown }),
    );
    const values = (await appCollectors.taskStatusChangesTotal.get()).values;
    expect(values).toEqual([expect.objectContaining({ labels: { to_status: "DONE" }, value: 1 })]);
  });

  it("leaves status untouched when moving into an unmapped column - only position/columnId change", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task); // pre-move, status: TODO
    mockDb.column.findUnique.mockResolvedValueOnce({ id: "col-2", mappedStatus: null });
    const moved = buildTask({ columnId: "col-2", position: 1500 });
    mockDb.task.update.mockResolvedValueOnce(moved);
    mockDb.task.findUniqueOrThrow.mockResolvedValueOnce(moved);

    await moveTaskToColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
      taskId: VALID_TASK_ID,
      targetColumnId: "col-2",
      position: 1500,
    });

    expect(mockDb.task.updateMany).not.toHaveBeenCalled();
    expect(mockDb.task.update).toHaveBeenCalledWith({
      where: { id: VALID_TASK_ID },
      data: { columnId: "col-2", position: 1500 },
    });
    expect((await appCollectors.taskStatusChangesTotal.get()).values).toEqual([]);
  });

  it("does not record a status metric when the mapped status equals the task's current status", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task); // status: TODO
    mockDb.column.findUnique.mockResolvedValueOnce({ id: "col-2", mappedStatus: "TODO" });
    // Row's real current status already matches the target - the conditional
    // updateMany's `status: { not: "TODO" }` matches zero rows.
    mockDb.task.updateMany.mockResolvedValueOnce({ count: 0 });
    const moved = buildTask({ columnId: "col-2", status: "TODO" });
    mockDb.task.update.mockResolvedValueOnce(moved);
    mockDb.task.findUniqueOrThrow.mockResolvedValueOnce(moved);

    await moveTaskToColumn(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, {
      taskId: VALID_TASK_ID,
      targetColumnId: "col-2",
      position: 1500,
    });

    expect((await appCollectors.taskStatusChangesTotal.get()).values).toEqual([]);
  });

  it("deleteTaskById broadcasts task:deleted with just the id", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);

    await expect(
      deleteTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID),
    ).resolves.toEqual({
      success: true,
    });
    expect((await appCollectors.tasksDeletedTotal.get()).values[0]?.value).toBe(1);

    expectEmittedToProject(
      VALID_PROJECT_ID,
      SOCKET_EVENTS.TASK_DELETED,
      { taskId: VALID_TASK_ID },
      VALID_USER.id,
    );
  });

  it("deleteTaskById throws NOT_FOUND without deleting", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);

    await expect(
      deleteTaskById(db, mockIo, VALID_PROJECT_ID, VALID_USER.id, VALID_TASK_ID),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.task.delete).not.toHaveBeenCalled();
  });
});

describe("addLabelToTaskById", () => {
  beforeEach(() => {
    appCollectors.taskLabelsAttachedTotal.reset();
  });

  it("attaches and broadcasts the fresh label list", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);
    mockDb.label.findUnique.mockResolvedValueOnce({ orgId: VALID_ORG_ID });
    mockDb.label.findMany.mockResolvedValueOnce([label]);

    await expect(addLabelToTaskById(db, mockIo, VALID_USER.id, labelInput)).resolves.toEqual([
      label,
    ]);

    expect(mockDb.taskLabel.upsert).toHaveBeenCalledOnce();
    expect((await appCollectors.taskLabelsAttachedTotal.get()).values[0]?.value).toBe(1);
    expectEmittedToProject(
      VALID_PROJECT_ID,
      SOCKET_EVENTS.TASK_LABELS_CHANGED,
      { taskId: VALID_TASK_ID, labels: [label] },
      VALID_USER.id,
    );
  });

  it("throws NOT_FOUND for an unknown task", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);

    await expect(addLabelToTaskById(db, mockIo, VALID_USER.id, labelInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it.each([
    ["the label belongs to another org", { orgId: ANOTHER_UUID }],
    ["the label does not exist", null],
  ])("throws NOT_FOUND when %s", async (_name, labelRow) => {
    mockDb.task.findUnique.mockResolvedValueOnce(task);
    mockDb.label.findUnique.mockResolvedValueOnce(labelRow);

    await expect(addLabelToTaskById(db, mockIo, VALID_USER.id, labelInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDb.taskLabel.upsert).not.toHaveBeenCalled();
  });
});

describe("removeLabelFromTaskById", () => {
  beforeEach(() => {
    appCollectors.taskLabelsDetachedTotal.reset();
  });

  it("detaches and broadcasts the remaining labels", async () => {
    mockDb.label.findMany.mockResolvedValueOnce([]);

    await expect(removeLabelFromTaskById(db, mockIo, VALID_USER.id, labelInput)).resolves.toEqual(
      [],
    );

    expect(mockDb.taskLabel.deleteMany).toHaveBeenCalledWith({
      where: { taskId: VALID_TASK_ID, labelId: VALID_LABEL_ID },
    });
    expect((await appCollectors.taskLabelsDetachedTotal.get()).values[0]?.value).toBe(1);
    expectEmittedToProject(
      VALID_PROJECT_ID,
      SOCKET_EVENTS.TASK_LABELS_CHANGED,
      { taskId: VALID_TASK_ID, labels: [] },
      VALID_USER.id,
    );
  });
});
