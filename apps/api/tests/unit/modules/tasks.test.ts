import { beforeEach, describe, vi, it, expect } from "vitest";

vi.mock("../../../src/config/env.js");

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init.js";
import { createTasksRouter } from "../../../src/modules/tasks/router.js";
import { mockEmit, mockIo, mockTo } from "../../mocks/socket.js";
import {
  ANOTHER_UUID,
  FIXED_DATE,
  makeCtx,
  VALID_COLUMN_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "../../helpers.js";
import { mockDb } from "../../mocks/database-mock.js";
import { SOCKET_EVENTS } from "@taskflow/shared";

const caller = createCallerFactory(createTRPCRouter({ tasks: createTasksRouter(mockIo) }));
const authed = () => caller(makeCtx(VALID_USER));

const mockTask = {
  id: VALID_TASK_ID,
  columnId: VALID_COLUMN_ID,
  title: "Fix login bug",
  description: null,
  assigneeId: null,
  priority: "HIGH" as const,
  status: "TODO" as const,
  position: 1000,
  dueDate: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

describe("tasks.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tasks for the column", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.task.findMany.mockResolvedValueOnce([mockTask]);

    const result = await authed().tasks.list({ orgId: VALID_ORG_ID, columnId: VALID_COLUMN_ID });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe(mockTask.title);
  });
});

describe("tasks.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a task by id", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(mockTask);
    expect((await authed().tasks.get({ taskId: VALID_TASK_ID })).title).toBe(mockTask.title);
  });

  it("throws NOT_FOUND when task missing", async () => {
    mockDb.task.findUnique.mockResolvedValueOnce(null);
    await expect(authed().tasks.get({ taskId: ANOTHER_UUID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("tasks.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a task and emits task:created", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.task.findFirst.mockResolvedValueOnce(null); // getMaxTaskPosition
    mockDb.task.create.mockResolvedValueOnce(mockTask);

    const result = await authed().tasks.create({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      data: { columnId: ANOTHER_UUID, title: mockTask.title, priority: mockTask.priority },
    });

    expect(result.title).toBe(mockTask.title);
    expect(mockTo).toHaveBeenCalledWith(`project:${VALID_PROJECT_ID}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_CREATED, { task: mockTask });
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("creates a notification when task is created with an assignee", async () => {
    const taskWithAssignee = { ...mockTask, assigneeId: ANOTHER_UUID };

    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.task.findFirst.mockResolvedValueOnce(null);
    mockDb.task.create.mockResolvedValueOnce(taskWithAssignee);
    // getActorName lookup
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce({});

    await authed().tasks.create({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      data: {
        columnId: VALID_COLUMN_ID,
        title: taskWithAssignee.title,
        assigneeId: taskWithAssignee.assigneeId,
      },
    });

    expect(mockDb.notification.create).toHaveBeenCalledOnce();
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "TASK_ASSIGNED",
          userId: ANOTHER_UUID,
          actorId: VALID_USER.id,
        }) as unknown,
      }),
    );
  });
});

describe("tasks.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates task and emits task:updated", async () => {
    const updated = { ...mockTask, title: "Fixed" };
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.task.findUnique.mockResolvedValueOnce(mockTask);
    mockDb.task.update.mockResolvedValueOnce(updated);

    const result = await authed().tasks.update({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      taskId: VALID_TASK_ID,
      data: { title: "Fixed" },
    });

    expect(result.title).toBe("Fixed");
    expect(mockTo).toHaveBeenCalledWith(`project:${VALID_PROJECT_ID}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_UPDATED, { task: updated });
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });

  it("notifies new assignee when assigneeId changes", async () => {
    const updatedTask = { ...mockTask, assigneeId: ANOTHER_UUID };

    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    // existing task has no assignee
    mockDb.task.findUnique.mockResolvedValueOnce({ ...mockTask, assigneeId: null });
    mockDb.task.update.mockResolvedValueOnce(updatedTask);
    // getActorName lookup
    mockDb.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
    mockDb.notification.create.mockResolvedValueOnce({});

    await authed().tasks.update({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      taskId: VALID_TASK_ID,
      data: { assigneeId: ANOTHER_UUID },
    });

    expect(mockDb.notification.create).toHaveBeenCalledOnce();
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "TASK_ASSIGNED",
          userId: ANOTHER_UUID,
        }) as unknown,
      }),
    );
  });

  it("does not notify when assigneeId does not change", async () => {
    const taskWithAssignee = { ...mockTask, assigneeId: ANOTHER_UUID };

    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.task.findUnique.mockResolvedValueOnce(taskWithAssignee);
    mockDb.task.update.mockResolvedValueOnce({ ...taskWithAssignee, title: "Renamed" });

    await authed().tasks.update({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      taskId: VALID_TASK_ID,
      data: { title: "Renamed" }, // assigneeId not in data -> no change
    });

    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });
});

describe("tasks.move", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves task and emits task:moved", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    const moved = { ...mockTask, columnId: VALID_COLUMN_ID, position: 2000 };
    mockDb.task.update.mockResolvedValueOnce(moved);

    const result = await authed().tasks.move({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      payload: { taskId: VALID_TASK_ID, targetColumnId: VALID_COLUMN_ID, position: 2000 },
    });

    expect(result.position).toBe(2000);
    expect(mockTo).toHaveBeenCalledWith(`project:${VALID_PROJECT_ID}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_MOVED, { task: moved });
  });
});

describe("tasks.delete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes task and emits task:deleted", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.task.findUnique.mockResolvedValueOnce(mockTask);
    mockDb.task.delete.mockResolvedValueOnce(mockTask);

    const result = await authed().tasks.delete({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
      taskId: VALID_TASK_ID,
    });

    expect(result).toEqual({ success: true });
    expect(mockTo).toHaveBeenCalledWith(`project:${VALID_PROJECT_ID}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_DELETED, { taskId: VALID_TASK_ID });
  });
});
