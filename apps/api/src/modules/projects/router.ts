import { z } from "zod";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";
import { createProjectSchema, idSchema, updateProjectSchema } from "@taskflow/shared";
import {
  createProjectInOrg,
  deleteProjectById,
  getProject,
  listProjects,
  updateProjectById,
} from "./service";

const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));
const adminProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));

export const projectsRouter = createTRPCRouter({
  list: memberProcedure
    .input(z.object({ orgId: idSchema }))
    .query(async ({ ctx, input }) => listProjects(ctx.db, input.orgId)),

  get: protectedProcedure
    .input(z.object({ projectId: idSchema }))
    .query(async ({ ctx, input }) => getProject(ctx.db, input.projectId)),

  create: memberProcedure
    .input(z.object({ orgId: idSchema, data: createProjectSchema }))
    .mutation(async ({ ctx, input }) => createProjectInOrg(ctx.db, input.orgId, input.data)),

  update: adminProcedure
    .input(z.object({ orgId: idSchema, projectId: idSchema, data: updateProjectSchema }))
    .mutation(async ({ ctx, input }) => updateProjectById(ctx.db, input.projectId, input.data)),

  delete: adminProcedure
    .input(z.object({ orgId: idSchema, projectId: idSchema }))
    .mutation(async ({ ctx, input }) => deleteProjectById(ctx.db, input.projectId)),
});
