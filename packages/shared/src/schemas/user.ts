import { z } from "zod";
import { idSchema } from "./common";

export const userSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100).nullable(),
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
  name: z.string().min(1).max(100).optional(),
  image: z.url().nullable().optional(),
});
