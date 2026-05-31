import { describe, expect, it } from "vitest";
import {
  boardSchema,
  columnSchema,
  createBoardSchema,
  createColumnSchema,
  reorderColumnsSchema,
  updateBoardSchema,
  updateColumnSchema,
} from "../board";
import { FIXED_DATE, VALID_UUID } from "./fixtures";

describe("boardSchema", () => {
  it("parses a valid board", () => {
    const result = boardSchema.parse({
      id: VALID_UUID,
      projectId: VALID_UUID,
      name: "Main Board",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(result.name).toBe("Main Board");
  });

  it("rejects empty name", () => {
    expect(() =>
      boardSchema.parse({
        id: VALID_UUID,
        projectId: VALID_UUID,
        name: "",
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      }),
    ).toThrow();
  });
});

describe("columnSchema", () => {
  it("parses a valid column", () => {
    const result = columnSchema.parse({
      id: VALID_UUID,
      boardId: VALID_UUID,
      name: "To Do",
      position: 1000,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(result.position).toBe(1000);
  });
});

describe("createBoardSchema", () => {
  it("accepts valid board creation payload", () => {
    const result = createBoardSchema.parse({ name: "Sprint 1", projectId: VALID_UUID });
    expect(result.name).toBe("Sprint 1");
  });

  it("rejects missing projectId", () => {
    expect(() => createBoardSchema.parse({ name: "Sprint 1" })).toThrow();
  });
});

describe("updateBoardSchema", () => {
  it("accepts empty object", () => {
    expect(updateBoardSchema.parse({})).toEqual({});
  });

  it("accepts partial name udpate", () => {
    const result = updateBoardSchema.parse({ name: "Sprint 2" });
    expect(result.name).toBe("Sprint 2");
  });
});

describe("createColumnSchema", () => {
  it("accepts column without position (optional)", () => {
    const result = createColumnSchema.parse({ name: "In Progress", boardId: VALID_UUID });
    expect(result.position).toBeUndefined();
  });

  it("accepts column with explicit position", () => {
    const result = createColumnSchema.parse({ name: "Done", boardId: VALID_UUID, position: 2000 });
    expect(result.position).toBe(2000);
  });
});

describe("updateColumnSchema", () => {
  it("accepts partial update with only name", () => {
    const result = updateColumnSchema.parse({ name: "Reviewed" });
    expect(result.name).toBe("Reviewed");
  });
});

describe("reorderColumnSchema", () => {
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
