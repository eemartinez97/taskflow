import { describe, it, expect } from "vitest";
import {
  socketTaskCreatedSchema,
  socketTaskDeletedSchema,
  presenceUserSchema,
  presenceCursorSchema,
} from "../socket";
import { VALID_UUID, validTaskPayload } from "./fixtures";

describe("socketTaskCreatedSchema", () => {
  it("accepts a valid task:created payload", () => {
    const result = socketTaskCreatedSchema.parse({ task: validTaskPayload });
    expect(result.task.title).toBe(validTaskPayload.title);
  });

  it("rejects payload without task", () => {
    expect(() => socketTaskCreatedSchema.parse({})).toThrow();
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

describe("presenceUserSchema — built from userSchema.pick()", () => {
  it("accepts a valid presence user", () => {
    const result = presenceUserSchema.parse({
      userId: VALID_UUID,
      name: "Alice",
      color: "#3B82F6",
    });
    expect(result.name).toBe("Alice");
    expect(result.color).toBe("#3B82F6");
  });

  it("rejects invalid color format", () => {
    expect(() =>
      presenceUserSchema.parse({ userId: VALID_UUID, name: "Alice", color: "blue" }),
    ).toThrow();
  });
});

describe("presenceCursorSchema", () => {
  it("accepts valid cursor coordinates", () => {
    const result = presenceCursorSchema.parse({ userId: VALID_UUID, x: 120.5, y: 300 });
    expect(result.x).toBe(120.5);
  });

  it("rejects missing coordinates", () => {
    expect(() => presenceCursorSchema.parse({ userId: VALID_UUID })).toThrow();
  });
});
