import type { Board, BoardWithColumns, Column, PrismaClient } from "@taskflow/database";
import {
  SOCKET_EVENTS,
  type CreateBoard,
  type ReorderColumns,
  type UpdateBoard,
} from "@taskflow/shared";
import {
  countBoards,
  createBoard,
  createColumn,
  createDefaultColumns,
  deleteBoard,
  deleteColumn,
  findBoardById,
  findBoardsByProject,
  findBoardWithColumns,
  findColumnById,
  getMaxColumnPosition,
  reorderColumns,
  updateBoard,
  updateColumnName,
} from "./repo";
import { TRPCError } from "../../trpc/init";
import type { AppServer } from "../../socket/events";
import { emitToProject } from "../../socket/emit";
import { appCollectors } from "../../metrics";
import { fireAndForget } from "../../utils/fire-and-forget";

/**
 * Broadcasts the fresh board (name + columns) to everyone viewing the
 * project. One event covers board rename + column add/rename/delete/reorder;
 * clients replace their boards.getByProject cache wholesale (server truth).
 *
 * Excludes the acting user's own connections - a WebSocket push structurally
 * beats their own mutation's HTTP response under any real latency, so
 * without this their board would visibly update while their own
 * button/spinner is still showing loading. Their own view updates from
 * their own mutation's response instead (see each client mutation's
 * onSuccess, which calls setData directly rather than invalidate).
 */
async function emitBoardUpdated(
  db: PrismaClient,
  io: AppServer,
  boardId: string,
  actorId: string,
): Promise<void> {
  const board = await findBoardWithColumns(db, boardId);
  if (!board) return;

  emitToProject(io, board.projectId, SOCKET_EVENTS.BOARD_UPDATED, { board }, actorId);
}

/**
 * Fire-and-forget wrapper for emitBoardUpdated - callers already committed
 * their DB write by the time they call this, so a broadcast failure must
 * never turn an already-successful mutation into a 500, and the caller's
 * own HTTP response shouldn't wait behind the extra board refetch this does
 * before emitting.
 */
function broadcastBoardUpdated(
  db: PrismaClient,
  io: AppServer,
  boardId: string,
  actorId: string,
  context: string,
): void {
  fireAndForget(
    emitBoardUpdated(db, io, boardId, actorId),
    `${context}: failed to broadcast board update`,
    { boardId },
  );
}

export async function listBoards(db: PrismaClient, projectId: string): Promise<Board[]> {
  return findBoardsByProject(db, projectId);
}

export async function getBoard(db: PrismaClient, boardId: string): Promise<Board> {
  const board = await findBoardById(db, boardId);
  if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });
  return board;
}

/** Fetches a single board (with its columns) by id. NOT_FOUND when missing. */
export async function getBoardWithColumns(
  db: PrismaClient,
  boardId: string,
): Promise<BoardWithColumns | null> {
  await getBoard(db, boardId);

  return findBoardWithColumns(db, boardId);
}

export async function createBoardInProject(db: PrismaClient, data: CreateBoard): Promise<Board> {
  const board = await createBoard(db, data);
  appCollectors.boardsCreatedTotal.inc();
  // Reuse the same defaults as project bootstrap so a new board is never empty.
  await createDefaultColumns(db, board.id);
  return board;
}

export async function updateBoardById(
  db: PrismaClient,
  io: AppServer,
  boardId: string,
  actorId: string,
  data: UpdateBoard,
): Promise<Board> {
  await getBoard(db, boardId);

  const updated = await updateBoard(db, boardId, data);
  broadcastBoardUpdated(db, io, boardId, actorId, "boards.updateBoardById");

  return updated;
}

export async function addColumn(
  db: PrismaClient,
  io: AppServer,
  boardId: string,
  actorId: string,
  name: string,
): Promise<Column> {
  const position = await getMaxColumnPosition(db, boardId);
  const column = await createColumn(db, { boardId, name, position });
  appCollectors.columnsCreatedTotal.inc();

  broadcastBoardUpdated(db, io, boardId, actorId, "boards.addColumn");

  return column;
}

export async function reorderBoardColumn(
  db: PrismaClient,
  io: AppServer,
  actorId: string,
  payload: ReorderColumns,
): Promise<{ success: true }> {
  await reorderColumns(db, payload);
  broadcastBoardUpdated(db, io, payload.boardId, actorId, "boards.reorderBoardColumn");

  return { success: true };
}

export async function renameColumn(
  db: PrismaClient,
  io: AppServer,
  columnId: string,
  actorId: string,
  name: string,
): Promise<Column> {
  const column = await findColumnById(db, columnId);

  if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found." });

  const updated = await updateColumnName(db, columnId, name);
  broadcastBoardUpdated(db, io, column.boardId, actorId, "boards.renameColumn");

  return updated;
}

export async function deleteColumnById(
  db: PrismaClient,
  io: AppServer,
  columnId: string,
  actorId: string,
): Promise<{ success: true }> {
  const column = await findColumnById(db, columnId);

  if (!column) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found." });

  // Cascades to the column's tasks (schema: Task.column onDelete: Cascade)
  await deleteColumn(db, columnId);
  appCollectors.columnsDeletedTotal.inc();
  broadcastBoardUpdated(db, io, column.boardId, actorId, "boards.deleteColumnById");

  return { success: true };
}

/**
 * Deletes a board and everything under it (columns -> tasks via cascade).
 * Guards against removing the project's last board so the board page is never
 * left empty.
 */
export async function deleteBoardById(
  db: PrismaClient,
  boardId: string,
): Promise<{ success: true }> {
  const board = await getBoard(db, boardId);

  if ((await countBoards(db, board.projectId)) <= 1) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A project must keep at least one board.",
    });
  }

  await deleteBoard(db, boardId);
  return { success: true };
}
