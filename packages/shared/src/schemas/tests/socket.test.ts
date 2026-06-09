import { describe, it, expect } from "vitest";
import {
  socketTaskCreatedSchema,
  socketTaskDeletedSchema,
  presenceUserSchema,
  presenceCursorSchema,
  socketTaskUpdatedSchema,
  socketTaskMovedSchema,
  socketCommentCreatedSchema,
} from "../socket";
import { VALID_UUID, validCommentPayload, validTaskPayload } from "./fixtures";

describe("socketTaskCreatedSchema", () => {
  it("accepts a valid task:created payload", () => {
    const result = socketTaskCreatedSchema.parse({ task: validTaskPayload });
    expect(result.task.title).toBe(validTaskPayload.title);
  });

  it("rejects payload without task", () => {
    expect(() => socketTaskCreatedSchema.parse({})).toThrow();
  });
});

describe("socketTaskUpdatedSchema", () => {
  it("accepts a valid task:updated payload", () => {
    const result = socketTaskUpdatedSchema.parse({ task: validTaskPayload });
    expect(result.task.id).toBe(validTaskPayload.id);
  });

  it("rejects missing task field", () => {
    expect(() => socketTaskUpdatedSchema.parse({ id: VALID_UUID })).toThrow();
  });
});

describe("socketTaskMovedSchema", () => {
  it("accepts a valid task:moved payload", () => {
    const result = socketTaskMovedSchema.parse({ task: validTaskPayload });
    expect(result.task.columnId).toBe(validTaskPayload.columnId);
  });

  it("rejects missing task field", () => {
    expect(() => socketTaskMovedSchema.parse({})).toThrow();
  });
});

describe("socketTaskDeletedSchema", () => {
  it("accepts a valid task:deleted payload", () => {
    const result = socketTaskDeletedSchema.parse({ taskId: VALID_UUID });
    expect(result.taskId).toBe(VALID_UUID);
  });

  it("rejects non-UUID taskId", () => {
    expect(() => socketTaskDeletedSchema.parse({ taskId: "not-a-uuid" })).toThrow();
  });
});

describe("socketCommentCreatedSchema", () => {
  it("accepts a valid comment:created payload", () => {
    const result = socketCommentCreatedSchema.parse({ comment: validCommentPayload });
    expect(result.comment.body).toBe(validCommentPayload.body);
  });

  it("rejects missing comment field", () => {
    expect(() => socketCommentCreatedSchema.parse({})).toThrow();
  });

  it("rejects comment with empty body", () => {
    expect(() =>
      socketCommentCreatedSchema.parse({ comment: { ...validCommentPayload, body: "" } }),
    ).toThrow();
  });
});

describe("presenceUserSchema", () => {
  it("accepts a valid presence user", () => {
    const result = presenceUserSchema.parse({
      userId: VALID_UUID,
      name: "Alice",
      color: "#3B82F6",
    });
    expect(result.name).toBe("Alice");
    expect(result.color).toBe("#3B82F6");
  });

  it("accepts null name (nullable from userSchema)", () => {
    const result = presenceUserSchema.parse({
      userId: VALID_UUID,
      name: null,
      color: "#3B82F6",
    });
    expect(result.name).toBeNull();
  });

  it("rejects invalid color format", () => {
    expect(() =>
      presenceUserSchema.parse({
        userId: VALID_UUID,
        name: "Alice",
        color: "blue",
      }),
    ).toThrow();
  });

  it("rejects missing userId", () => {
    expect(() =>
      presenceUserSchema.parse({
        name: "Alice",
        color: "#3B82F6",
      }),
    ).toThrow();
  });
});

describe("presenceCursorSchema", () => {
  it("accepts valid cursor coordinates", () => {
    const result = presenceCursorSchema.parse({
      userId: VALID_UUID,
      x: 120.5,
      y: 300,
    });
    expect(result.x).toBe(120.5);
  });

  it("accepts zero coordinates", () => {
    const result = presenceCursorSchema.parse({
      userId: VALID_UUID,
      x: 0,
      y: 0,
    });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("rejects missing coordinates", () => {
    expect(() =>
      presenceCursorSchema.parse({
        userId: VALID_UUID,
      }),
    ).toThrow();
  });

  it("rejects non-number coordinates", () => {
    expect(() =>
      presenceCursorSchema.parse({
        userId: VALID_UUID,
        x: "left",
        y: 0,
      }),
    ).toThrow();
  });
});
