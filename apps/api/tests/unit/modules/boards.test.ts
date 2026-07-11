import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env");

import {
  FIXED_DATE,
  makeCtx,
  VALID_BOARD_ID,
  VALID_COLUMN_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_USER,
} from "../../helpers";

import { createCallerFactory, createTRPCRouter } from "../../../src/trpc/init";
import { boardsRouter } from "../../../src/modules/boards/router";
import { mockDb } from "../../mocks/database-mock";

const caller = createCallerFactory(createTRPCRouter({ boards: boardsRouter }));
const authed = () => caller(makeCtx(VALID_USER));

const mockBoard = {
  id: VALID_BOARD_ID,
  projectId: VALID_PROJECT_ID,
  name: "Main Board",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

const mockColumn = {
  id: VALID_COLUMN_ID,
  boardId: VALID_BOARD_ID,
  name: "To Do",
  position: 1000,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

describe("boards.list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns boards for the project", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.board.findMany.mockResolvedValueOnce([mockBoard]);

    const result = await authed().boards.list({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID });
    expect(result[0]?.name).toBe("Main Board");
  });
});

describe("boards.getByProject", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the board with columns", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.board.findFirst.mockResolvedValueOnce({ ...mockBoard, columns: [mockColumn] });

    const result = await authed().boards.getByProject({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
    });
    expect(result?.columns).toHaveLength(1);
    expect(result?.columns[0]?.name).toBe(mockColumn.name);
  });

  it("returns null when no board exists", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.board.findFirst.mockResolvedValueOnce(null);
    expect(
      await authed().boards.getByProject({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID }),
    ).toBeNull();
  });
});

describe("boards.create", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a board", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.board.create.mockResolvedValueOnce(mockBoard);

    const result = await authed().boards.create({
      orgId: VALID_ORG_ID,
      data: { name: "Sprint 1", projectId: VALID_PROJECT_ID },
    });
    expect(result.name).toBe(mockBoard.name);
  });
});

describe("boards.update", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates the board name", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.board.findUnique.mockResolvedValueOnce({ ...mockBoard, columns: [] });
    mockDb.board.update.mockResolvedValueOnce({ ...mockBoard, name: "Sprint 2" });

    const result = await authed().boards.update({
      orgId: VALID_ORG_ID,
      boardId: VALID_BOARD_ID,
      data: { name: "Sprint 2" },
    });
    expect(result.name).toBe("Sprint 2");
  });

  it("throws NOT_FOUND when board missing", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.board.findUnique.mockResolvedValueOnce(null);

    await expect(
      authed().boards.update({ orgId: VALID_ORG_ID, boardId: VALID_BOARD_ID, data: { name: "X" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("boards.addColumn", () => {
  beforeEach(() => vi.resetAllMocks());

  it("adds a column to the board", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.column.findFirst.mockResolvedValueOnce(null); // getMaxPosition -> 0 + STEP
    mockDb.column.create.mockResolvedValueOnce(mockColumn);

    const result = await authed().boards.addColumn({
      orgId: VALID_ORG_ID,
      boardId: VALID_BOARD_ID,
      name: "To Do",
    });
    expect(result.name).toBe("To Do");
    expect(mockDb.column.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 1000, boardId: VALID_BOARD_ID }) as unknown,
      }),
    );
  });
});

describe("boards.reorderColumns", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reorders columns and returns success", async () => {
    mockDb.membership.findUnique.mockResolvedValueOnce({ role: "MEMBER" });
    mockDb.$transaction.mockResolvedValueOnce([]);

    const result = await authed().boards.reorderColumns({
      orgId: VALID_ORG_ID,
      payload: {
        boardId: VALID_BOARD_ID,
        columns: [
          { id: VALID_COLUMN_ID, position: 2000 },
          { id: VALID_COLUMN_ID, position: 1000 },
        ],
      },
    });
    expect(result).toEqual({ success: true });
  });
});
