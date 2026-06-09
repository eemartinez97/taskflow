import { describe, expect, it } from "vitest";
import {
  createTaskSchema,
  moveTaskSchema,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
  updateTaskSchema,
} from "../task";
import { ANOTHER_UUID, VALID_UUID, validTaskPayload } from "./fixtures";

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

  it("rejects empty string", () => {
    expect(() => taskPrioritySchema.parse("")).toThrow();
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

  it("rejects empty string", () => {
    expect(() => taskStatusSchema.parse("")).toThrow();
  });
});

describe("createTaskSchema", () => {
  it("accepts a minimal valid task (title + columnId only)", () => {
    const { columnId, title } = validTaskPayload;
    const result = createTaskSchema.parse({ columnId, title });
    expect(result.title).toBe(title); // default applied
    expect(result.columnId).toBe(columnId);
  });

  it("applies default priority NONE when priority is omitted", () => {
    const result = createTaskSchema.parse({
      columnId: validTaskPayload.columnId,
      title: validTaskPayload.title,
    });
    // Verify the property exists and carries the default value - not undefined
    expect(result).toHaveProperty("priority");
    expect(result.priority).toBe("NONE");
  });

  it("accepts all optional fields", () => {
    const dueDate = new Date("2026-12-31");
    const result = createTaskSchema.parse({
      columnId: validTaskPayload.columnId,
      title: validTaskPayload.title,
      description: "A full description",
      assigneeId: VALID_UUID,
      priority: "HIGH",
      dueDate,
    });
    expect(result.assigneeId).toBe(VALID_UUID);
    expect(result.priority).toBe("HIGH");
    expect(result.dueDate).toStrictEqual(dueDate);
    expect(result.description).toBe("A full description");
  });

  it("rejects empty title", () => {
    expect(() => createTaskSchema.parse({ ...validTaskPayload, title: "" })).toThrow();
  });

  it("rejects title exceeding 255 characters", () => {
    expect(() => createTaskSchema.parse({ ...validTaskPayload, title: "a".repeat(256) })).toThrow();
  });

  it("rejects description exceeding 10,000 characters", () => {
    expect(() =>
      createTaskSchema.parse({ ...validTaskPayload, description: "a".repeat(10_001) }),
    ).toThrow();
  });

  it("rejects invalid priority", () => {
    expect(() => createTaskSchema.parse({ ...validTaskPayload, priority: "CRITICAL" })).toThrow();
  });

  it("rejects missing columnId", () => {
    expect(() => createTaskSchema.parse({ title: validTaskPayload.title })).toThrow();
  });

  it("rejects invalid columnId (non-UUID)", () => {
    expect(() => createTaskSchema.parse({ ...validTaskPayload, columnId: "not-a-uuid" })).toThrow();
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

  it("accepts priority update", () => {
    const result = updateTaskSchema.parse({ priority: "URGENT" });
    expect(result.priority).toBe("URGENT");
  });

  it("accepts null assigneeId to unassign a user", () => {
    const result = updateTaskSchema.parse({ assigneeId: null });
    expect(result.assigneeId).toBeNull();
  });

  it("accepts null dueDate to clear due date", () => {
    const result = updateTaskSchema.parse({ dueDate: null });
    expect(result.dueDate).toBeNull();
  });

  it("accepts a valid dueDate Date object", () => {
    const dueDate = new Date("2027-01-15");
    const result = updateTaskSchema.parse({ dueDate });
    expect(result.dueDate).toStrictEqual(dueDate);
  });

  it("accepts a description update", () => {
    const result = updateTaskSchema.parse({ description: "New description" });
    expect(result.description).toBe("New description");
  });

  it("rejects title exceeding 255 characters", () => {
    expect(() => updateTaskSchema.parse({ title: "a".repeat(256) })).toThrow();
  });

  it("rejects empty title", () => {
    expect(() => updateTaskSchema.parse({ title: "" })).toThrow();
  });

  it("rejects invalid status", () => {
    expect(() => updateTaskSchema.parse({ status: "BLOCKED" })).toThrow();
  });

  it("rejects invalid priority", () => {
    expect(() => updateTaskSchema.parse({ priority: "EXTREME" })).toThrow();
  });

  it("rejects description exceeding 10,000 characters", () => {
    expect(() => updateTaskSchema.parse({ description: "a".repeat(10_001) })).toThrow();
  });

  it("does not accept columnId — column moves use moveTaskSchema", () => {
    // columnId is intentionally omitted from updateTaskSchema
    // Passing it should be silently stripped (Zod strips unknown keys by default)
    const result = updateTaskSchema.parse({
      title: "Task",
      columnId: VALID_UUID, // unknown key — Zod strips it
    });
    expect(result).not.toHaveProperty("columnId");
    expect(result.title).toBe("Task");
  });
});

describe("taskSchema", () => {
  it("parses a full valid task from the fixture", () => {
    const result = taskSchema.parse(validTaskPayload);
    expect(result.id).toBe(validTaskPayload.id);
    expect(result.title).toBe(validTaskPayload.title);
    expect(result.priority).toBe(validTaskPayload.priority);
    expect(result.status).toBe(validTaskPayload.status);
    expect(result.position).toBe(validTaskPayload.position);
  });

  it("accepts null assigneeId and dueDate", () => {
    const result = taskSchema.parse({
      ...validTaskPayload,
      assigneeId: null,
      dueDate: null,
    });
    expect(result.assigneeId).toBeNull();
    expect(result.dueDate).toBeNull();
  });

  it("accepts null description", () => {
    const result = taskSchema.parse({ ...validTaskPayload, description: null });
    expect(result.description).toBeNull();
  });

  it("accepts a non-null assigneeId", () => {
    const result = taskSchema.parse({ ...validTaskPayload, assigneeId: ANOTHER_UUID });
    expect(result.assigneeId).toBe(ANOTHER_UUID);
  });

  it("accepts fractional position for lexorank-style ordering", () => {
    const result = taskSchema.parse({ ...validTaskPayload, position: 1500.5 });
    expect(result.position).toBe(1500.5);
  });

  it("rejects missing required fields", () => {
    expect(() => taskSchema.parse({ title: "Incomplete" })).toThrow();
  });

  it("rejects invalid priority in full schema", () => {
    expect(() => taskSchema.parse({ ...validTaskPayload, priority: "EXTREME" })).toThrow();
  });

  it("rejects invalid status in full schema", () => {
    expect(() => taskSchema.parse({ ...validTaskPayload, status: "BLOCKED" })).toThrow();
  });

  it("rejects non-UUID id", () => {
    expect(() => taskSchema.parse({ ...validTaskPayload, id: "not-a-uuid" })).toThrow();
  });
});

describe("moveTaskSchema", () => {
  it("accepts valid move payload", () => {
    const result = moveTaskSchema.parse({
      taskId: validTaskPayload.id,
      targetColumnId: ANOTHER_UUID,
      position: 2000,
    });
    expect(result.taskId).toBe(validTaskPayload.id);
    expect(result.targetColumnId).toBe(ANOTHER_UUID);
    expect(result.position).toBe(2000);
  });

  it("accepts fractional position for mid-column insertion", () => {
    const result = moveTaskSchema.parse({
      taskId: validTaskPayload.id,
      targetColumnId: ANOTHER_UUID,
      position: 1500.5,
    });
    expect(result.position).toBe(1500.5);
  });

  it("rejects non-number position", () => {
    expect(() =>
      moveTaskSchema.parse({
        taskId: validTaskPayload.id,
        targetColumnId: VALID_UUID,
        position: "first",
      }),
    ).toThrow();
  });

  it("rejects missing targetColumnId", () => {
    expect(() => {
      moveTaskSchema.parse({ taskId: validTaskPayload.id, position: 1000 });
    }).toThrow();
  });

  it("rejects missing taskId", () => {
    expect(() =>
      moveTaskSchema.parse({
        targetColumnId: ANOTHER_UUID,
        position: 1000,
      }),
    ).toThrow();
  });

  it("rejects non-UUID taskId", () => {
    expect(() =>
      moveTaskSchema.parse({
        taskId: "not-a-uuid",
        targetColumnId: ANOTHER_UUID,
        position: 1000,
      }),
    ).toThrow();
  });

  it("rejects non-UUID targetColumnId", () => {
    expect(() =>
      moveTaskSchema.parse({
        taskId: validTaskPayload.id,
        targetColumnId: "not-a-uuid",
        position: 1000,
      }),
    ).toThrow();
  });
});
