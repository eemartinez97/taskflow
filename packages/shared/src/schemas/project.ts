import z from "zod";
import { idSchema, slugSchema } from "./common";

const projectKeySchema = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[A-Z][A-Z0-9]+$/, "Project key must be uppercase letters and numbers");

export const projectSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  name: z.string().min(1).max(100),
  key: projectKeySchema,
  description: z.string().max(500).nullable(),
  slug: slugSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  key: projectKeySchema,
  description: z.string().max(500).optional(),
  slug: slugSchema,
});

export const updateProjectSchema = createProjectSchema.partial();
