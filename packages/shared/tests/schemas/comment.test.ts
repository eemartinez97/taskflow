import { describe, expect, it } from "vitest";
import { commentSchema, createCommentSchema } from "../../src";
import { validCommentPayload } from "./fixtures.js";

describe("createCommentSchema", () => {
  it("accepts a valid comment", () => {
    const { taskId, body } = validCommentPayload;
    const result = createCommentSchema.parse({ taskId, body });
    expect(result.body).toBe(body);
  });

  it("rejects empty body", () => {
    expect(() =>
      createCommentSchema.parse({ taskId: validCommentPayload.taskId, body: "" }),
    ).toThrow();
  });

  it("rejects body exceeding 5000 characters", () => {
    expect(() =>
      createCommentSchema.parse({ taskId: validCommentPayload.taskId, body: "a".repeat(5001) }),
    ).toThrow();
  });

  it("rejects missing taskId", () => {
    expect(() => createCommentSchema.parse({ body: "Hello" })).toThrow();
  });
});

describe("commentSchema", () => {
  it("parses a full valid comment", () => {
    const result = commentSchema.parse(validCommentPayload);
    expect(result.authorId).toBe(validCommentPayload.authorId);
  });
});
