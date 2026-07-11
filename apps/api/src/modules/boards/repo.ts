import {
  boardWithColumns,
  type Board,
  type BoardWithColumns,
  type Column,
  type PrismaClient,
} from "@taskflow/database";
import type { CreateBoard, CreateColumn, ReorderColumns, UpdateBoard } from "@taskflow/shared";
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

export async function findBoardByProject(
  db: PrismaClient,
  projectId: string,
): Promise<BoardWithColumns | null> {
  return db.board.findFirst({
    where: { projectId },
    include: boardWithColumns,
  });
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
