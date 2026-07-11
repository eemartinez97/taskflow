import { z } from "zod";
import { createTRPCRouter, protectedProcedure, roleGuard } from "../../trpc/procedures";
import { createLabelSchema, idSchema } from "@taskflow/shared";
import { createLabelInOrg, deleteLabelById, listLabels } from "./service";

const memberProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN", "MEMBER"]));
const adminProcedure = protectedProcedure.use(roleGuard(["OWNER", "ADMIN"]));

export const labelsRouter = createTRPCRouter({
  list: memberProcedure
    .input(z.object({ orgId: idSchema }))
    .query(async ({ ctx, input }) => listLabels(ctx.db, input.orgId)),

  create: adminProcedure
    .input(z.object({ orgId: idSchema, data: createLabelSchema }))
    .mutation(async ({ ctx, input }) => createLabelInOrg(ctx.db, input.orgId, input.data)),

  delete: adminProcedure
    .input(z.object({ orgId: idSchema, labelId: idSchema }))
    .mutation(async ({ ctx, input }) => deleteLabelById(ctx.db, input.labelId)),
});
