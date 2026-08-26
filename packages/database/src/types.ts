import { type Prisma } from "./generated";
import type {
  boardWithColumns,
  commentWithAuthor,
  formerAssigneeSelect,
  invitationWithInviter,
  invitationWithOrg,
  membershipWithUser,
  notificationWithActor,
  orgWithMembership,
} from "./selects";

/**
 * GetPayload types derived from the reusable query fragments in selects.ts
 *
 * The `typeof fragment` ensures the type always matches what the query returns -
 * if the fragment changes, the type changes automatically
 */
export type BoardWithColumns = Prisma.BoardGetPayload<{
  include: typeof boardWithColumns;
}>;

export type MembershipWithUser = Prisma.MembershipGetPayload<{
  include: typeof membershipWithUser;
}>;

/** Ex-member still assigned to a task in the org - see selects.ts's formerAssigneeSelect. */
export type FormerAssignee = Prisma.UserGetPayload<{
  select: typeof formerAssigneeSelect;
}>;

export type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: typeof notificationWithActor;
}>;

export type OrgWithMembership = Prisma.OrgGetPayload<{
  include: typeof orgWithMembership;
}>;

export type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof commentWithAuthor;
}>;

export type InvitationWithOrg = Prisma.InvitationGetPayload<{
  include: typeof invitationWithOrg;
}>;

export type InvitationWithInviter = Prisma.InvitationGetPayload<{
  include: typeof invitationWithInviter;
}>;
