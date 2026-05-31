import z from "zod";
import { colorSchema, idSchema } from "./common";

export const labelSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  name: z.string().min(1).max(50),
  color: colorSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: colorSchema,
});
