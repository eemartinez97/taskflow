import { describe, expect, it } from "vitest";
import {
  boardSchema,
  columnSchema,
  createBoardSchema,
  createColumnSchema,
  reorderColumnsSchema,
  updateBoardSchema,
  updateColumnSchema,
} from "@taskflow/shared";
import { expectSchema, VALID_UUID, validBoardPayload, validColumnPayload } from "./fixtures";

describe("boardSchema", () => {
  it("parses a valid board", () => {
    const { name } = validBoardPayload;
    const result = boardSchema.parse(validBoardPayload);
    expect(result.name).toBe(name);
  });

  it("rejects empty name", () => {
    expect(() => boardSchema.parse({ ...validBoardPayload, name: "" })).toThrow();
  });
});

describe("columnSchema", () => {
  it("parses a valid column", () => {
    const result = columnSchema.parse(validColumnPayload);
    expect(result.position).toBe(validColumnPayload.position);
  });
});

describe("createBoardSchema", () => {
  it("accepts valid board creation payload", () => {
    const { name, projectId } = validBoardPayload;
    const result = createBoardSchema.parse({ name, projectId });
    expect(result.name).toBe(name);
  });

  it("rejects missing projectId", () => {
    expect(() => createBoardSchema.parse({ name: "Sprint 1" })).toThrow();
  });
});

describe("updateBoardSchema", () => {
  it("accepts empty object", () => {
    expect(updateBoardSchema.parse({})).toEqual({});
  });

  it("accepts partial name update", () => {
    const result = updateBoardSchema.parse({ name: "Sprint 2" });
    expect(result.name).toBe("Sprint 2");
  });
});

describe("createColumnSchema", () => {
  it("accepts column without position (optional)", () => {
    const result = createColumnSchema.parse({
      name: validColumnPayload.name,
      boardId: validColumnPayload.boardId,
    });
    expect(result.position).toBeUndefined();
  });

  it("accepts column with explicit position", () => {
    const result = createColumnSchema.parse({
      name: validColumnPayload.name,
      boardId: validColumnPayload.boardId,
      position: 2000,
    });
    expect(result.position).toBe(2000);
  });
});

describe("updateColumnSchema", () => {
  it("accepts partial update with only name", () => {
    const result = updateColumnSchema.parse({ name: "Reviewed" });
    expect(result.name).toBe("Reviewed");
  });
});

describe("reorderColumnsSchema", () => {
  it("accepts valid reorder payload", () => {
    const result = reorderColumnsSchema.parse({
      boardId: VALID_UUID,
      columns: [
        { id: VALID_UUID, position: 1000 },
        { id: VALID_UUID, position: 2000 },
      ],
    });
    expect(result.columns).toHaveLength(2);
  });

  it("rejects columns with non-number position", () => {
    expect(() =>
      reorderColumnsSchema.parse({
        boardId: VALID_UUID,
        columns: [{ id: VALID_UUID, position: "first" }],
      }),
    ).toThrow();
  });
});
