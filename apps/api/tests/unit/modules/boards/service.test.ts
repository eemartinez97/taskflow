import { describe, expect, it } from "vitest";
import { SOCKET_EVENTS } from "@taskflow/shared";

import {
  addColumn,
  createBoardInProject,
  deleteBoardById,
  deleteColumnById,
  getBoardWithColumns,
  listBoards,
  renameColumn,
  reorderBoardColumn,
  updateBoardById,
} from "../../../../src/modules/boards/service";
import { buildBoard, buildBoardWithColumns, buildColumn } from "../../../factories";
import { db, VALID_BOARD_ID, VALID_COLUMN_ID, VALID_PROJECT_ID } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";
import { expectEmittedToProject, expectNoEmit } from "../../../support/socket-assert";

const board = buildBoard();
const boardWithCols = buildBoardWithColumns();
const column = buildColumn();

/** Every mutation ends in emitBoardUpdated -> findBoardWithColumns. */
const arriveAtEmit = (value: unknown = boardWithCols): void => {
  mockDb.board.findUnique.mockResolvedValue(value);
};

describe("read paths", () => {
  it("listBoards", async () => {
    mockDb.board.findMany.mockResolvedValueOnce([board]);

    await expect(listBoards(db, VALID_PROJECT_ID)).resolves.toEqual([board]);
  });

  it("createBoardInProject", async () => {
    mockDb.board.create.mockResolvedValueOnce(board);

    await expect(
      createBoardInProject(db, { projectId: VALID_PROJECT_ID, name: "Sprint" }),
    ).resolves.toBe(board);
  });
});

describe("updateBoardById", () => {
  it("throws NOT_FOUND when the board does not exist", async () => {
    mockDb.board.findUnique.mockResolvedValueOnce(null);

    await expect(updateBoardById(db, mockIo, VALID_BOARD_ID, { name: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDb.board.update).not.toHaveBeenCalled();
  });

  it("updates and broadcasts the fresh board", async () => {
    arriveAtEmit();
    mockDb.board.update.mockResolvedValueOnce({ ...board, name: "Renamed" });

    await expect(
      updateBoardById(db, mockIo, VALID_BOARD_ID, { name: "Renamed" }),
    ).resolves.toMatchObject({ name: "Renamed" });

    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.BOARD_UPDATED, {
      board: boardWithCols,
    });
  });
});

describe("addColumn", () => {
  it("appends at maxPosition + POSITION_STEP and broadcasts", async () => {
    mockDb.column.findFirst.mockResolvedValueOnce({ position: 4000 });
    mockDb.column.create.mockResolvedValueOnce(buildColumn({ name: "QA", position: 5000 }));
    arriveAtEmit();

    await expect(addColumn(db, mockIo, VALID_BOARD_ID, "QA")).resolves.toMatchObject({
      name: "QA",
    });

    expect(mockDb.column.create).toHaveBeenCalledWith({
      data: { boardId: VALID_BOARD_ID, name: "QA", position: 5000 },
    });
    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.BOARD_UPDATED, {
      board: boardWithCols,
    });
  });

  // Covers the `if (!board) return;` guard inside emitBoardUpdated
  it("stays silent when the board disappeared between write and broadcast", async () => {
    mockDb.column.findFirst.mockResolvedValueOnce(null);
    mockDb.column.create.mockResolvedValueOnce(column);
    arriveAtEmit(null);

    await expect(addColumn(db, mockIo, VALID_BOARD_ID, "QA")).resolves.toBe(column);

    expectNoEmit();
  });
});

describe("reorderBoardColumn", () => {
  it("persists positions and broadcasts once", async () => {
    arriveAtEmit();

    await expect(
      reorderBoardColumn(db, mockIo, {
        boardId: VALID_BOARD_ID,
        columns: [{ id: VALID_COLUMN_ID, position: 1000 }],
      }),
    ).resolves.toEqual({ success: true });

    expect(mockDb.$transaction).toHaveBeenCalledOnce();
    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.BOARD_UPDATED, {
      board: boardWithCols,
    });
  });
});

describe("renameColumn / deleteColumnById", () => {
  it.each([
    ["renameColumn", () => renameColumn(db, mockIo, VALID_COLUMN_ID, "Done")],
    ["deleteColumnById", () => deleteColumnById(db, mockIo, VALID_COLUMN_ID)],
  ])("%s throws NOT_FOUND for a missing column", async (_name, call) => {
    mockDb.column.findUnique.mockResolvedValueOnce(null);

    await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("renameColumn updates the name and broadcasts the board", async () => {
    mockDb.column.findUnique.mockResolvedValueOnce(column);
    mockDb.column.update.mockResolvedValueOnce(buildColumn({ name: "Done" }));
    arriveAtEmit();

    await expect(renameColumn(db, mockIo, VALID_COLUMN_ID, "Done")).resolves.toMatchObject({
      name: "Done",
    });
    expectEmittedToProject(VALID_PROJECT_ID, SOCKET_EVENTS.BOARD_UPDATED, {
      board: boardWithCols,
    });
  });

  it("deleteColumnById deletes (tasks cascade) and broadcasts", async () => {
    mockDb.column.findUnique.mockResolvedValueOnce(column);
    arriveAtEmit();

    await expect(deleteColumnById(db, mockIo, VALID_COLUMN_ID)).resolves.toEqual({ success: true });

    expect(mockDb.column.delete).toHaveBeenCalledWith({ where: { id: VALID_COLUMN_ID } });
  });
});

describe("getBoardWithColumns", () => {
  it("throws NOT_FOUND when the board does not exist", async () => {
    mockDb.board.findUnique.mockResolvedValueOnce(null);

    await expect(getBoardWithColumns(db, VALID_BOARD_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns the board with columns when found", async () => {
    mockDb.board.findUnique
      .mockResolvedValueOnce(board) // getBoard -> findBoardById
      .mockResolvedValueOnce(boardWithCols); // findBoardWithColumns

    await expect(getBoardWithColumns(db, VALID_BOARD_ID)).resolves.toEqual(boardWithCols);
  });
});

describe("deleteBoardById", () => {
  it("throws FORBIDDEN when deleting the project's last board", async () => {
    mockDb.board.findUnique.mockResolvedValueOnce(board);
    mockDb.board.count.mockResolvedValueOnce(1);

    await expect(deleteBoardById(db, VALID_BOARD_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockDb.board.delete).not.toHaveBeenCalled();
  });

  it("deletes the board when more than one exists", async () => {
    mockDb.board.findUnique.mockResolvedValueOnce(board);
    mockDb.board.count.mockResolvedValueOnce(2);

    await expect(deleteBoardById(db, VALID_BOARD_ID)).resolves.toEqual({ success: true });

    expect(mockDb.board.delete).toHaveBeenCalledWith({ where: { id: VALID_BOARD_ID } });
  });
});
