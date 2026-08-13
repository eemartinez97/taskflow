import { z } from "zod";
import { ROLES } from "../constants";
import { idSchema, slugSchema } from "./common";
import { emailField, nameField } from "../utils/normalize";

export const roleSchema = z.enum(ROLES);

/** Every role except OWNER - an org can only ever have exactly one OWNER, never invited into. */
export const invitableRoleSchema = roleSchema.exclude(["OWNER"]);

export const orgSchema = z.object({
  id: idSchema,
  name: nameField(1, 100),
  slug: slugSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createOrgSchema = orgSchema.pick({
  name: true,
  slug: true,
});

export const updateOrgSchema = createOrgSchema.partial();

export const membershipSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  userId: idSchema,
  role: roleSchema,
  cursorsHidden: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const inviteMemberSchema = z.object({
  email: emailField(),
  role: invitableRoleSchema,
});

export const updateMemberRoleSchema = inviteMemberSchema.pick({ role: true });

export const updateCursorPreferenceSchema = z.object({
  cursorsHidden: z.boolean(),
});
