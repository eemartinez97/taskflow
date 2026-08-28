import { beforeEach, describe, expect, it, vi } from "vitest";
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
  setColumnStatus,
  updateBoardById,
} from "../../../../src/modules/boards/service";
import { appCollectors } from "../../../../src/metrics";
import { buildBoard, buildBoardWithColumns, buildColumn } from "../../../factories";
import {
  db,
  VALID_BOARD_ID,
  VALID_COLUMN_ID,
  VALID_PROJECT_ID,
  VALID_USER,
} from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockEmit, mockIo } from "../../../mocks/socket";
import { expectEmittedToProject, expectNoEmit } from "../../../support/socket-assert";

const board = buildBoard();
const boardWithCols = buildBoardWithColumns();
const column = buildColumn();

/** Every mutation ends in emitBoardUpdated -> findBoardWithColumns. */
const arriveAtEmit = (value: unknown = boardWithCols): void => {
  mockDb.board.findUnique.mockResolvedValue(value);
};

describe("read paths", () => {
  beforeEach(() => {
    appCollectors.boardsCreatedTotal.reset();
  });

  it("listBoards", async () => {
    mockDb.board.findMany.mockResolvedValueOnce([board]);

    await expect(listBoards(db, VALID_PROJECT_ID)).resolves.toEqual([board]);
  });

  it("createBoardInProject", async () => {
    mockDb.board.create.mockResolvedValueOnce(board);

    await expect(
      createBoardInProject(db, { projectId: VALID_PROJECT_ID, name: "Sprint" }),
    ).resolves.toBe(board);
    expect((await appCollectors.boardsCreatedTotal.get()).values[0]?.value).toBe(1);
  });
});

describe("updateBoardById", () => {
  it("throws NOT_FOUND when the board does not exist", async () => {
    mockDb.board.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateBoardById(db, mockIo, VALID_BOARD_ID, VALID_USER.id, { name: "x" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDb.board.update).not.toHaveBeenCalled();
  });

  it("updates and broadcasts the fresh board, excluding the actor's own connections", async () => {
    arriveAtEmit();
    mockDb.board.update.mockResolvedValueOnce({ ...board, name: "Renamed" });

    await expect(
      updateBoardById(db, mockIo, VALID_BOARD_ID, VALID_USER.id, { name: "Renamed" }),
    ).resolves.toMatchObject({ name: "Renamed" });

    // broadcastBoardUpdated now runs fire-and-forget (see boards/service.ts)
    // so the response doesn't wait behind its own board refetch.
    await vi.waitFor(() => {
      expectEmittedToProject(
        VALID_PROJECT_ID,
        SOCKET_EVENTS.BOARD_UPDATED,
        { board: boardWithCols },
        VALID_USER.id,
      );
    });
  });
});

describe("addColumn", () => {
  beforeEach(() => {
    appCollectors.columnsCreatedTotal.reset();
  });

  it("appends at maxPosition + POSITION_STEP and broadcasts, excluding the actor", async () => {
    mockDb.column.findFirst.mockResolvedValueOnce({ position: 4000 });
    mockDb.column.create.mockResolvedValueOnce(buildColumn({ name: "QA", position: 5000 }));
    arriveAtEmit();

    await expect(addColumn(db, mockIo, VALID_BOARD_ID, VALID_USER.id, "QA")).resolves.toMatchObject(
      {
        name: "QA",
      },
    );

    expect(mockDb.column.create).toHaveBeenCalledWith({
      data: { boardId: VALID_BOARD_ID, name: "QA", position: 5000 },
    });
    expect((await appCollectors.columnsCreatedTotal.get()).values[0]?.value).toBe(1);
    await vi.waitFor(() => {
      expectEmittedToProject(
        VALID_PROJECT_ID,
        SOCKET_EVENTS.BOARD_UPDATED,
        { board: boardWithCols },
        VALID_USER.id,
      );
    });
  });

  it("logs (does not throw) when the broadcast fails", async () => {
    mockDb.column.findFirst.mockResolvedValueOnce({ position: 4000 });
    mockDb.column.create.mockResolvedValueOnce(buildColumn({ name: "QA", position: 5000 }));
    mockDb.board.findUnique.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(addColumn(db, mockIo, VALID_BOARD_ID, VALID_USER.id, "QA")).resolves.toMatchObject(
      {
        name: "QA",
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  // Covers the `if (!board) return;` guard inside emitBoardUpdated
  it("stays silent when the board disappeared between write and broadcast", async () => {
    mockDb.column.findFirst.mockResolvedValueOnce(null);
    mockDb.column.create.mockResolvedValueOnce(column);
    arriveAtEmit(null);

    await expect(addColumn(db, mockIo, VALID_BOARD_ID, VALID_USER.id, "QA")).resolves.toBe(column);

    expectNoEmit();
  });
});

describe("reorderBoardColumn", () => {
  it("persists positions and broadcasts once, excluding the actor", async () => {
    arriveAtEmit();

    await expect(
      reorderBoardColumn(db, mockIo, VALID_USER.id, {
        boardId: VALID_BOARD_ID,
        columns: [{ id: VALID_COLUMN_ID, position: 1000 }],
      }),
    ).resolves.toEqual({ success: true });

    expect(mockDb.$transaction).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expectEmittedToProject(
        VALID_PROJECT_ID,
        SOCKET_EVENTS.BOARD_UPDATED,
        { board: boardWithCols },
        VALID_USER.id,
      );
    });
  });
});

describe("renameColumn / deleteColumnById", () => {
  beforeEach(() => {
    appCollectors.columnsDeletedTotal.reset();
  });

  it.each([
    ["renameColumn", () => renameColumn(db, mockIo, VALID_COLUMN_ID, VALID_USER.id, "Done")],
    ["deleteColumnById", () => deleteColumnById(db, mockIo, VALID_COLUMN_ID, VALID_USER.id)],
    ["setColumnStatus", () => setColumnStatus(db, mockIo, VALID_COLUMN_ID, VALID_USER.id, "DONE")],
  ])("%s throws NOT_FOUND for a missing column", async (_name, call) => {
    mockDb.column.findUnique.mockResolvedValueOnce(null);

    await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("renameColumn updates the name and broadcasts the board, excluding the actor", async () => {
    mockDb.column.findUnique.mockResolvedValueOnce(column);
    mockDb.column.update.mockResolvedValueOnce(buildColumn({ name: "Done" }));
    arriveAtEmit();

    await expect(
      renameColumn(db, mockIo, VALID_COLUMN_ID, VALID_USER.id, "Done"),
    ).resolves.toMatchObject({
      name: "Done",
    });
    await vi.waitFor(() => {
      expectEmittedToProject(
        VALID_PROJECT_ID,
        SOCKET_EVENTS.BOARD_UPDATED,
        { board: boardWithCols },
        VALID_USER.id,
      );
    });
  });

  it("deleteColumnById deletes (tasks cascade) and broadcasts", async () => {
    mockDb.column.findUnique.mockResolvedValueOnce(column);
    arriveAtEmit();

    await expect(deleteColumnById(db, mockIo, VALID_COLUMN_ID, VALID_USER.id)).resolves.toEqual({
      success: true,
    });

    expect(mockDb.column.delete).toHaveBeenCalledWith({ where: { id: VALID_COLUMN_ID } });
    expect((await appCollectors.columnsDeletedTotal.get()).values[0]?.value).toBe(1);
  });
});

describe("setColumnStatus", () => {
  beforeEach(() => {
    appCollectors.taskStatusChangesTotal.reset();
  });

  it("maps the column to a status, bulk-syncs existing tasks, and broadcasts both the tasks and the board excluding the actor", async () => {
    mockDb.column.findUnique.mockResolvedValueOnce(column);
    mockDb.column.update.mockResolvedValueOnce(buildColumn({ mappedStatus: "DONE" }));
    mockDb.task.findMany.mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
    mockDb.task.updateMany.mockResolvedValueOnce({ count: 3 });
    arriveAtEmit();

    await expect(
      setColumnStatus(db, mockIo, VALID_COLUMN_ID, VALID_USER.id, "DONE"),
    ).resolves.toMatchObject({ mappedStatus: "DONE" });

    expect(mockDb.column.update).toHaveBeenCalledWith({
      where: { id: VALID_COLUMN_ID },
      data: { mappedStatus: "DONE" },
    });
    expect(mockDb.task.findMany).toHaveBeenCalledWith({
      where: { columnId: VALID_COLUMN_ID, status: { not: "DONE" } },
      select: { id: true },
    });
    expect(mockDb.task.updateMany).toHaveBeenCalledWith({
      where: { columnId: VALID_COLUMN_ID, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
    const values = (await appCollectors.taskStatusChangesTotal.get()).values;
    expect(values).toEqual([expect.objectContaining({ labels: { to_status: "DONE" }, value: 3 })]);

    // Other viewers' tasks.list/tasks.get caches need this to reflect the
    // bulk sync - see use-board-realtime.ts's onTaskStatusBulkUpdated.
    expectEmittedToProject(
      VALID_PROJECT_ID,
      SOCKET_EVENTS.TASK_STATUS_BULK_UPDATED,
      { columnId: VALID_COLUMN_ID, status: "DONE", taskIds: ["t1", "t2", "t3"] },
      VALID_USER.id,
    );
    await vi.waitFor(() => {
      expectEmittedToProject(
        VALID_PROJECT_ID,
        SOCKET_EVENTS.BOARD_UPDATED,
        { board: boardWithCols },
        VALID_USER.id,
      );
    });
  });

  it("does not record a metric or broadcast task changes when no tasks were sitting in the column", async () => {
    mockDb.column.findUnique.mockResolvedValueOnce(column);
    mockDb.column.update.mockResolvedValueOnce(buildColumn({ mappedStatus: "DONE" }));
    mockDb.task.findMany.mockResolvedValueOnce([]);
    arriveAtEmit();

    await setColumnStatus(db, mockIo, VALID_COLUMN_ID, VALID_USER.id, "DONE");

    expect(mockDb.task.updateMany).not.toHaveBeenCalled();
    expect((await appCollectors.taskStatusChangesTotal.get()).values).toEqual([]);
    expect(mockEmit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.TASK_STATUS_BULK_UPDATED,
      expect.anything(),
    );
  });

  it("clears the mapping with a null status and does NOT touch existing tasks", async () => {
    mockDb.column.findUnique.mockResolvedValueOnce(buildColumn({ mappedStatus: "DONE" }));
    mockDb.column.update.mockResolvedValueOnce(buildColumn({ mappedStatus: null }));
    arriveAtEmit();

    await expect(
      setColumnStatus(db, mockIo, VALID_COLUMN_ID, VALID_USER.id, null),
    ).resolves.toMatchObject({ mappedStatus: null });

    expect(mockDb.column.update).toHaveBeenCalledWith({
      where: { id: VALID_COLUMN_ID },
      data: { mappedStatus: null },
    });
    expect(mockDb.task.findMany).not.toHaveBeenCalled();
    expect(mockDb.task.updateMany).not.toHaveBeenCalled();
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
