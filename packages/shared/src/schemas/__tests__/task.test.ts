import { describe, expect, it } from "vitest";
import { createTaskSchema, moveTaskSchema, taskSchema } from "../task";
import { VALID_UUID, validTaskPayload } from "./fixtures";

describe("createTaskSchema", () => {
  it("accepts a minimal valid task", () => {
    const result = createTaskSchema.parse({ columnId: VALID_UUID, title: "Fix bug" });
    expect(result.priority).toBe("NONE"); // default applied
    expect(result.title).toBe("Fix bug");
  });

  it("rejects empty title", () => {
    expect(() => createTaskSchema.parse({ columnId: VALID_UUID, title: "" })).toThrow();
  });

  it("rejects title exceeding 255 characters", () => {
    expect(() =>
      createTaskSchema.parse({ columnId: VALID_UUID, title: "a".repeat(256) }),
    ).toThrow();
  });

  it("rejects invalid priority", () => {
    expect(() =>
      createTaskSchema.parse({ columnId: VALID_UUID, title: "Task", priority: "CRITICAL" }),
    ).toThrow();
  });
});

describe("taskSchema", () => {
  it("parses a full valid task", () => {
    const task = taskSchema.parse(validTaskPayload);
    expect(task.status).toBe(validTaskPayload.status);
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
});
