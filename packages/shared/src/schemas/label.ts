import { z } from "zod";
import { colorSchema, idSchema } from "./common";
import { nameField } from "../utils/normalize";

export const labelSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  name: nameField(1, 50),
  color: colorSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createLabelSchema = labelSchema.pick({
  name: true,
  color: true,
});
