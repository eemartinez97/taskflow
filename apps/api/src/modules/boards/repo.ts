import type {
  Board,
  BoardWithColumns,
  Column,
  DbClient,
  Prisma,
  PrismaClient,
} from "@taskflow/database";
import { boardWithColumns } from "@taskflow/database";
import type {
  CreateBoard,
  CreateColumn,
  ReorderColumns,
  TaskStatus,
  UpdateBoard,
} from "@taskflow/shared";
import { POSITION_STEP } from "@taskflow/shared";

import { stripUndefined } from "../../utils/prisma";

export async function findBoardsByProject(db: PrismaClient, projectId: string): Promise<Board[]> {
  return db.board.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
}

export async function findBoardWithColumns(
  db: PrismaClient,
  boardId: string,
): Promise<BoardWithColumns | null> {
  return db.board.findUnique({
    where: { id: boardId },
    include: boardWithColumns,
  });
}

export async function findBoardById(db: PrismaClient, boardId: string): Promise<Board | null> {
  return db.board.findUnique({ where: { id: boardId } });
}

export async function createBoard(db: PrismaClient, data: CreateBoard): Promise<Board> {
  return db.board.create({ data });
}

export async function updateBoard(
  db: PrismaClient,
  boardId: string,
  data: UpdateBoard,
): Promise<Board> {
  return db.board.update({ where: { id: boardId }, data: stripUndefined(data) });
}

export async function createColumn(
  db: PrismaClient,
  data: CreateColumn & { position: number },
): Promise<Column> {
  return db.column.create({ data });
}

export async function reorderColumns(db: PrismaClient, payload: ReorderColumns): Promise<void> {
  await db.$transaction(
    payload.columns.map((col) =>
      db.column.update({
        where: { id: col.id },
        data: { position: col.position },
      }),
    ),
  );
}

/** Returns the max column position for a board, or 0 if no columns exist. */
export async function getMaxColumnPosition(db: PrismaClient, boardId: string): Promise<number> {
  const last = await db.column.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  return (last?.position ?? 0) + POSITION_STEP;
}

export async function findColumnById(db: PrismaClient, columnId: string): Promise<Column | null> {
  return db.column.findUnique({ where: { id: columnId } });
}

export async function updateColumnName(
  db: PrismaClient,
  columnId: string,
  name: string,
): Promise<Column> {
  return db.column.update({ where: { id: columnId }, data: { name } });
}

export async function updateColumnMappedStatus(
  db: DbClient,
  columnId: string,
  status: TaskStatus | null,
): Promise<Column> {
  return db.column.update({ where: { id: columnId }, data: { mappedStatus: status } });
}

export async function deleteColumn(db: PrismaClient, columnId: string): Promise<void> {
  await db.column.delete({ where: { id: columnId } });
}

/**
 * The four standard Kanban columns every new board starts with.
 * Single source of truth for both project bootstrap (createDefaultBoard) and
 * ad-hoc board creation (createBoardInProject).
 *
 * Each ships pre-mapped to the matching TaskStatus, so a brand-new board's
 * status auto-derivation (see tasks/service.ts) works correctly with zero
 * setup - dragging a task into "Done" sets status DONE immediately. Boards
 * created before this field existed keep mappedStatus: null on all their
 * columns until an admin maps them via boards.setColumnStatus.
 */
const DEFAULT_COLUMNS: Omit<Prisma.ColumnCreateInput, "board">[] = [
  { name: "To Do", position: 1000, mappedStatus: "TODO" },
  { name: "In Progress", position: 2000, mappedStatus: "IN_PROGRESS" },
  { name: "In Review", position: 3000, mappedStatus: "IN_REVIEW" },
  { name: "Done", position: 4000, mappedStatus: "DONE" },
];

/** Creates the default Kanban columns for a freshly created board. */
export async function createDefaultColumns(db: PrismaClient, boardId: string): Promise<void> {
  await db.$transaction(
    DEFAULT_COLUMNS.map((col) => db.column.create({ data: { boardId, ...col } })),
  );
}

/** Total boards in a project - used to prevent deleting the last one. */
export async function countBoards(db: PrismaClient, projectId: string): Promise<number> {
  return db.board.count({ where: { projectId } });
}

/** Deletes a board. Cascades to its columns and their tasks (schema onDelete). */
export async function deleteBoard(db: PrismaClient, boardId: string): Promise<void> {
  await db.board.delete({ where: { id: boardId } });
}
