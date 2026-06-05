import { describe, expect, it } from "vitest";
import {
  createTaskSchema,
  moveTaskSchema,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
  updateTaskSchema,
} from "../task";
import { VALID_UUID, validTaskPayload } from "./fixtures";

describe("taskPrioritySchema", () => {
  it("accepts all valid priorities", () => {
    const priorities = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
    for (const priority of priorities) {
      expect(taskPrioritySchema.parse(priority)).toBe(priority);
    }
  });

  it("rejects unknown priority", () => {
    expect(() => taskPrioritySchema.parse("CRITICAL")).toThrow();
  });
});

describe("taskStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const statuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] as const;
    for (const status of statuses) {
      expect(taskStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects unknown status", () => {
    expect(() => taskStatusSchema.parse("BLOCKED")).toThrow();
  });
});

describe("createTaskSchema", () => {
  it("accepts a minimal valid task", () => {
    const result = createTaskSchema.parse({ columnId: VALID_UUID, title: "Fix bug" });
    expect(result.priority).toBe("NONE"); // default applied
    expect(result.title).toBe("Fix bug");
  });

  it("accepts all optional fields", () => {
    const result = createTaskSchema.parse({
      columnId: VALID_UUID,
      title: "Task",
      description: "A description",
      assigneeId: VALID_UUID,
      priority: "HIGH",
      dueDate: new Date("2026-12-31"),
    });
    expect(result.assigneeId).toBe(VALID_UUID);
    expect(result.dueDate).toBeInstanceOf(Date);
  });

  it("rejects empty title", () => {
    expect(() => createTaskSchema.parse({ columnId: VALID_UUID, title: "" })).toThrow();
  });

  it("rejects title exceeding 255 characters", () => {
    expect(() =>
      createTaskSchema.parse({ columnId: VALID_UUID, title: "a".repeat(256) }),
    ).toThrow();
  });

  it("rejects description exceeding 10000 characters", () => {
    expect(() =>
      createTaskSchema.parse({
        columnId: VALID_UUID,
        title: "Task",
        description: "a".repeat(10_001),
      }),
    ).toThrow();
  });

  it("rejects invalid priority", () => {
    expect(() =>
      createTaskSchema.parse({ columnId: VALID_UUID, title: "Task", priority: "CRITICAL" }),
    ).toThrow();
  });
});

describe("updateTaskSchema", () => {
  it("accepts empty object - all fields optional", () => {
    expect(updateTaskSchema.parse({})).toEqual({});
  });

  it("accepts title-only update", () => {
    const result = updateTaskSchema.parse({ title: "Updated title" });
    expect(result.title).toBe("Updated title");
  });

  it("accepts status update", () => {
    const result = updateTaskSchema.parse({ status: "DONE" });
    expect(result.status).toBe("DONE");
  });

  it("accepts null assigneeId to unassign", () => {
    const result = updateTaskSchema.parse({ assigneeId: null });
    expect(result.assigneeId).toBeNull();
  });

  it("accepts null dueDate to clear due date", () => {
    const result = updateTaskSchema.parse({ dueDate: null });
    expect(result.dueDate).toBeNull();
  });

  it("rejects invalid status", () => {
    expect(() => updateTaskSchema.parse({ status: "BLOCKED" })).toThrow();
  });

  it("rejects title exceeding 255 characters", () => {
    expect(() => updateTaskSchema.parse({ title: "a".repeat(256) })).toThrow();
  });
});

describe("taskSchema", () => {
  it("parses a full valid task", () => {
    const task = taskSchema.parse(validTaskPayload);
    expect(task.status).toBe(validTaskPayload.status);
    expect(task.priority).toBe(validTaskPayload.priority);
  });

  it("accepts null assigneeId and dueDate", () => {
    const result = taskSchema.parse({ ...validTaskPayload, assigneeId: null, dueDate: null });
    expect(result.assigneeId).toBeNull();
    expect(result.dueDate).toBeNull();
  });
});

describe("moveTaskSchema", () => {
  it("accepts valid move payload", () => {
    const result = moveTaskSchema.parse({
      taskId: VALID_UUID,
      targetColumnId: VALID_UUID,
      position: 2000,
    });
    expect(result.position).toBe(2000);
  });

  it("rejects non-number position", () => {
    expect(() =>
      moveTaskSchema.parse({
        taskId: VALID_UUID,
        targetColumnId: VALID_UUID,
        position: "first",
      }),
    ).toThrow();
  });

  it("rejects missing targetColumnId", () => {
    expect(() => {
      moveTaskSchema.parse({ taskId: VALID_UUID, position: 1000 });
    }).toThrow();
  });
});
