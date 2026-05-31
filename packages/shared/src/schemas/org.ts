import z from "zod";
import { ROLES } from "../constants";
import { idSchema, slugSchema } from "./common";

export const roleSchema = z.enum(ROLES);

export const orgSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
});

export const updateOrgSchema = createOrgSchema.partial();

export const membershipSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  userId: idSchema,
  role: roleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const inviteMemberSchema = z.object({
  email: z.email(),
  role: roleSchema.exclude(["OWNER"]),
});
