import type { Board, Column, PrismaClient } from "@taskflow/database";
import type { CreateBoard, ReorderColumns, UpdateBoard } from "@taskflow/shared";
import {
  createBoard,
  createColumn,
  findBoardByProject,
  findBoardsByProject,
  findBoardWithColumns,
  getMaxColumnPosition,
  reorderColumns,
  updateBoard,
} from "./repo";
import { TRPCError } from "../../trpc/init";

export async function listBoards(db: PrismaClient, projectId: string): Promise<Board[]> {
  return findBoardsByProject(db, projectId);
}

export async function getBoardByProject(
  db: PrismaClient,
  projectId: string,
): Promise<(Board & { columns: Column[] }) | null> {
  return findBoardByProject(db, projectId);
}

export async function createBoardInProject(db: PrismaClient, data: CreateBoard): Promise<Board> {
  return createBoard(db, data);
}

export async function updateBoardById(
  db: PrismaClient,
  boardId: string,
  data: UpdateBoard,
): Promise<Board> {
  const board = await findBoardWithColumns(db, boardId);

  if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found." });

  return updateBoard(db, boardId, data);
}

export async function addColumn(db: PrismaClient, boardId: string, name: string): Promise<Column> {
  const position = await getMaxColumnPosition(db, boardId);
  return createColumn(db, { boardId, name, position });
}

export async function reorderBoardColumn(
  db: PrismaClient,
  payload: ReorderColumns,
): Promise<{ success: true }> {
  await reorderColumns(db, payload);
  return { success: true };
}
