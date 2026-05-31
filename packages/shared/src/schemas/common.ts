import z from "zod";

// Reusable base fields
export const idSchema = z.uuid();

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens");

export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");
