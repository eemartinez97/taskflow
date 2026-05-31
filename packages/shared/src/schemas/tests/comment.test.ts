import { describe, expect, it } from "vitest";
import { commentSchema, createCommentSchema } from "../comment";
import { FIXED_DATE, VALID_UUID } from "./fixtures";

describe("createCommentSchema", () => {
  it("accepts a valid comment", () => {
    const result = createCommentSchema.parse({ taskId: VALID_UUID, body: "Looks good!" });
    expect(result.body).toBe("Looks good!");
  });

  it("rejects empty body", () => {
    expect(() => createCommentSchema.parse({ taskId: VALID_UUID, body: "" })).toThrow();
  });

  it("rejects body exceeding 5000 characters", () => {
    expect(() =>
      createCommentSchema.parse({ taskId: VALID_UUID, body: "a".repeat(5001) }),
    ).toThrow();
  });

  it("rejects missing taskId", () => {
    expect(() => createCommentSchema.parse({ body: "Hello" })).toThrow();
  });
});

describe("commentSchema", () => {
  it("parses a full valid comment", () => {
    const result = commentSchema.parse({
      id: VALID_UUID,
      taskId: VALID_UUID,
      authorId: VALID_UUID,
      body: "LGTM",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(result.authorId).toBe(VALID_UUID);
  });
});
