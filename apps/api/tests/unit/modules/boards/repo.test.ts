import { describe, expect, it } from "vitest";

import {
  countBoards,
  createBoard,
  createColumn,
  deleteBoard,
  deleteColumn,
  findBoardsByProject,
  findBoardWithColumns,
  findColumnById,
  getMaxColumnPosition,
  reorderColumns,
  updateBoard,
  updateColumnName,
} from "../../../../src/modules/boards/repo";
import { buildBoard, buildBoardWithColumns, buildColumn } from "../../../factories";
import { boardWithColumns } from "../../../mocks/database-mock";
import { db, VALID_BOARD_ID, VALID_COLUMN_ID, VALID_PROJECT_ID } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { itDelegatesToPrisma } from "../../../support/repo-contract";

describe("boards repo", () => {
  itDelegatesToPrisma([
    {
      name: "findBoardsByProject",
      delegate: mockDb.board.findMany,
      resolves: [buildBoard()],
      call: () => findBoardsByProject(db, VALID_PROJECT_ID),
      args: { where: { projectId: VALID_PROJECT_ID }, orderBy: { createdAt: "asc" } },
    },
    {
      name: "findBoardWithColumns",
      delegate: mockDb.board.findUnique,
      resolves: buildBoardWithColumns(),
      call: () => findBoardWithColumns(db, VALID_BOARD_ID),
      args: { where: { id: VALID_BOARD_ID }, include: boardWithColumns },
    },
    {
      name: "createBoard",
      delegate: mockDb.board.create,
      resolves: buildBoard(),
      call: () => createBoard(db, { projectId: VALID_PROJECT_ID, name: "Sprint" }),
      args: { data: { projectId: VALID_PROJECT_ID, name: "Sprint" } },
    },
    {
      name: "updateBoard strips undefined",
      delegate: mockDb.board.update,
      resolves: buildBoard(),
      call: () => updateBoard(db, VALID_BOARD_ID, { name: "Renamed" }),
      args: { where: { id: VALID_BOARD_ID }, data: { name: "Renamed" } },
    },
    {
      name: "createColumn",
      delegate: mockDb.column.create,
      resolves: buildColumn(),
      call: () => createColumn(db, { boardId: VALID_BOARD_ID, name: "QA", position: 5000 }),
      args: { data: { boardId: VALID_BOARD_ID, name: "QA", position: 5000 } },
    },
    {
      name: "findColumnById",
      delegate: mockDb.column.findUnique,
      resolves: buildColumn(),
      call: () => findColumnById(db, VALID_COLUMN_ID),
      args: { where: { id: VALID_COLUMN_ID } },
    },
    {
      name: "updateColumnName",
      delegate: mockDb.column.update,
      resolves: buildColumn({ name: "Done" }),
      call: () => updateColumnName(db, VALID_COLUMN_ID, "Done"),
      args: { where: { id: VALID_COLUMN_ID }, data: { name: "Done" } },
    },
    {
      name: "deleteColumn",
      delegate: mockDb.column.delete,
      resolves: buildColumn(),
      call: () => deleteColumn(db, VALID_COLUMN_ID),
      args: { where: { id: VALID_COLUMN_ID } },
      returns: undefined,
    },
    {
      name: "countBoards",
      delegate: mockDb.board.count,
      resolves: 3,
      call: () => countBoards(db, VALID_PROJECT_ID),
      args: { where: { projectId: VALID_PROJECT_ID } },
      returns: 3,
    },
    {
      name: "deleteBoard",
      delegate: mockDb.board.delete,
      resolves: buildBoard(),
      call: () => deleteBoard(db, VALID_BOARD_ID),
      args: { where: { id: VALID_BOARD_ID } },
      returns: undefined,
    },
  ]);
});

describe("getMaxColumnPosition", () => {
  it.each([
    ["adds POSITION_STEP to the last position", { position: 3000 }, 4000],
    ["starts at POSITION_STEP on an empty board", null, 1000],
  ])("%s", async (_name, last, expected) => {
    mockDb.column.findFirst.mockResolvedValueOnce(last);

    await expect(getMaxColumnPosition(db, VALID_BOARD_ID)).resolves.toBe(expected);

    expect(mockDb.column.findFirst).toHaveBeenCalledWith({
      where: { boardId: VALID_BOARD_ID },
      orderBy: { position: "desc" },
      select: { position: true },
    });
  });
});

describe("reorderColumns", () => {
  it("issues one update per column inside a single transaction", async () => {
    await reorderColumns(db, {
      boardId: VALID_BOARD_ID,
      columns: [
        { id: "c1", position: 1000 },
        { id: "c2", position: 2000 },
      ],
    });

    expect(mockDb.column.update.mock.calls.map(([arg]) => arg)).toEqual([
      { where: { id: "c1" }, data: { position: 1000 } },
      { where: { id: "c2" }, data: { position: 2000 } },
    ]);
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });
});
