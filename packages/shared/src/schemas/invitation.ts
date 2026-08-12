import { z } from "zod";
import { INVITATION_STATUSES } from "../constants";
import { idSchema } from "./common";
import { emailField } from "../utils/normalize";
import { invitableRoleSchema } from "./org";

export const invitationStatusSchema = z.enum(INVITATION_STATUSES);

/** Full invitation row - server-side / admin-table shape. Never sent to a non-admin. */
export const invitationSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  email: emailField(),
  role: invitableRoleSchema,
  status: invitationStatusSchema,
  invitedById: idSchema.nullable(),
  expiresAt: z.date(),
  respondedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Invitation row as rendered in an org's admin invitations table.
 * Expiry has no stored/wire field on purpose - a PENDING row whose
 * `expiresAt` has passed must render as "Expired" without a cron ever having
 * to flip a column, same rationale as `InvitationStatus` itself having no
 * EXPIRED member. Compute it from `expiresAt` at render time (client clock),
 * not once server-side at fetch time - a value cached at fetch time goes
 * stale for as long as the query result sits in cache.
 */
export const orgInvitationSchema = invitationSchema.omit({ orgId: true }).extend({
  inviterName: z.string().nullable(),
});

/**
 * Invitation row as rendered in the INVITEE's own "pending invitations"
 * list (`auth.listMine`-equivalent) - self-scoped by construction (the
 * server resolves it from the caller's own session email), so it never
 * needs to carry the target email back to the client.
 */
export const myInvitationSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  orgName: z.string(),
  role: invitableRoleSchema,
  expiresAt: z.date(),
  createdAt: z.date(),
});

export const invitationPreviewStateSchema = z.enum([
  "VALID",
  "EXPIRED",
  "REVOKED",
  "DECLINED",
  "ALREADY_ACCEPTED",
  "WRONG_ACCOUNT",
]);

/**
 * The shape returned by resolving a raw invitation token/id for display
 * BEFORE the viewer has accepted or declined anything - used by both the
 * signed-in token page and the public register-page prefill.
 *
 * Deliberately never includes the invitee's email - a token holder who
 * ISN'T the invitee (a leaked link, or `WRONG_ACCOUNT` state) must not
 * learn who the intended recipient was.
 */
export const invitationPreviewSchema = z.object({
  invitationId: idSchema,
  orgId: idSchema,
  orgName: z.string(),
  role: invitableRoleSchema,
  inviterName: z.string().nullable(),
  expiresAt: z.date(),
  state: invitationPreviewStateSchema,
});

export const invitationTokenSchema = z.object({
  token: z.string().min(1, { error: "Missing or invalid invitation link." }),
});

/** Either half of accept/decline's input - resolve by whichever the caller has on hand. */
export const invitationRefSchema = z.union([
  z.object({ invitationId: idSchema }),
  invitationTokenSchema,
]);
