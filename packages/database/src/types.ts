import { type Prisma } from "./generated/index.js";
import type {
  boardWithColumns,
  membershipWithUser,
  notificationWithActor,
  orgWithMembership,
} from "./selects.js";

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

export type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: typeof notificationWithActor;
}>;

export type OrgWithMembership = Prisma.OrgGetPayload<{
  include: typeof orgWithMembership;
}>;
