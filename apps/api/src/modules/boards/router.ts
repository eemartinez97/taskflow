import { z } from "zod";

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
} from "./service";
import {
  createBoardSchema,
  idSchema,
  reorderColumnsSchema,
  updateBoardSchema,
} from "@taskflow/shared";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";
import type { AppServer } from "../../socket/events";
import { nameField } from "@taskflow/shared";

const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));
const adminProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));

const _buildBoardsRouter = (io: AppServer) =>
  createTRPCRouter({
    list: memberProcedure
      .input(z.object({ orgId: idSchema, projectId: idSchema }))
      .query(async ({ ctx, input }) => listBoards(ctx.db, input.projectId)),

    get: memberProcedure
      .input(z.object({ orgId: idSchema, boardId: idSchema }))
      .query(async ({ ctx, input }) => getBoardWithColumns(ctx.db, input.boardId)),

    create: memberProcedure
      .input(z.object({ orgId: idSchema, data: createBoardSchema }))
      .mutation(async ({ ctx, input }) => createBoardInProject(ctx.db, input.data)),

    update: memberProcedure
      .input(z.object({ orgId: idSchema, boardId: idSchema, data: updateBoardSchema }))
      .mutation(async ({ ctx, input }) =>
        updateBoardById(ctx.db, io, input.boardId, ctx.user.id, input.data),
      ),

    delete: adminProcedure
      .input(z.object({ orgId: idSchema, boardId: idSchema }))
      .mutation(async ({ ctx, input }) => deleteBoardById(ctx.db, input.boardId)),

    addColumn: memberProcedure
      .input(z.object({ orgId: idSchema, boardId: idSchema, name: nameField(1, 100) }))
      .mutation(async ({ ctx, input }) =>
        addColumn(ctx.db, io, input.boardId, ctx.user.id, input.name),
      ),

    renameColumn: memberProcedure
      .input(z.object({ orgId: idSchema, columnId: idSchema, name: nameField(1, 100) }))
      .mutation(async ({ ctx, input }) =>
        renameColumn(ctx.db, io, input.columnId, ctx.user.id, input.name),
      ),

    deleteColumn: memberProcedure
      .input(z.object({ orgId: idSchema, columnId: idSchema }))
      .mutation(async ({ ctx, input }) =>
        deleteColumnById(ctx.db, io, input.columnId, ctx.user.id),
      ),

    reorderColumns: memberProcedure
      .input(z.object({ orgId: idSchema, payload: reorderColumnsSchema }))
      .mutation(async ({ ctx, input }) =>
        reorderBoardColumn(ctx.db, io, ctx.user.id, input.payload),
      ),
  });

export type BoardsRouter = ReturnType<typeof _buildBoardsRouter>;

export function createBoardsRouter(io: AppServer): BoardsRouter {
  return _buildBoardsRouter(io);
}
