import { z } from "zod";
import {
  createBoardSchema,
  idSchema,
  reorderColumnsSchema,
  updateBoardSchema,
} from "@taskflow/shared";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";
import {
  addColumn,
  createBoardInProject,
  getBoardByProject,
  listBoards,
  reorderBoardColumn,
  updateBoardById,
} from "./service";

const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));

export const boardsRouter = createTRPCRouter({
  list: memberProcedure
    .input(z.object({ orgId: idSchema, projectId: idSchema }))
    .query(async ({ ctx, input }) => listBoards(ctx.db, input.projectId)),

  getByProject: memberProcedure
    .input(z.object({ orgId: idSchema, projectId: idSchema }))
    .query(async ({ ctx, input }) => getBoardByProject(ctx.db, input.projectId)),

  create: memberProcedure
    .input(z.object({ orgId: idSchema, data: createBoardSchema }))
    .mutation(async ({ ctx, input }) => createBoardInProject(ctx.db, input.data)),

  update: memberProcedure
    .input(z.object({ orgId: idSchema, boardId: idSchema, data: updateBoardSchema }))
    .mutation(async ({ ctx, input }) => updateBoardById(ctx.db, input.boardId, input.data)),

  addColumn: memberProcedure
    .input(z.object({ orgId: idSchema, boardId: idSchema, name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => addColumn(ctx.db, input.boardId, input.name)),

  reorderColumns: memberProcedure
    .input(z.object({ orgId: idSchema, payload: reorderColumnsSchema }))
    .mutation(async ({ ctx, input }) => reorderBoardColumn(ctx.db, input.payload)),
});
