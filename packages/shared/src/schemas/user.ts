import { z } from "zod";
import { idSchema } from "./common";
import { nameField } from "../utils/normalize";

export const userSchema = z.object({
  id: idSchema,
  name: nameField(1, 100).nullable(),
  email: z.email(),
  image: z.url().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const sessionUserSchema = userSchema.pick({
  id: true,
  email: true,
  name: true,
  image: true,
});

export const updateUserSchema = z.object({
  name: nameField(1, 100).optional(),
  image: z.url().nullable().optional(),
});
