/**
 * Reusable Prisma query fragments — selects and includes.
 *
 * WHY Prisma.validator():
 * - Validates the shape against the generated schema at compile time.
 * - The inferred type flows through GetPayload — no manual type duplication.
 * - Single source of truth: change the select here, all types and queries
 *   that reference it update automatically.
 *
 * USAGE in a query:
 *   db.membership.findMany({ include: membershipWithUser.include })
 *
 * USAGE in a type:
 *   type MembershipWithUser = Prisma.MembershipGetPayload<typeof membershipWithUser>
 */

import { Prisma } from "./generated";

// User fragments

/** Minimal user profile - id, display name, email. Used in membership lists */
export const userBasicSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  email: true,
});

/** User profile with avatar - used in presence, comment authors, notification actor. */
export const userProfileSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  image: true,
});

// Membership fragments

/** Membership row with the member's basic profile */
export const membershipWithUser = Prisma.validator<Prisma.MembershipInclude>()({
  user: { select: userBasicSelect },
});

export const orgWithMembership = Prisma.validator<Prisma.OrgInclude>()({
  memberships: { select: { role: true } },
});

// Board fragment

/** Board with its columns ordered by position - used on the Kanban page. */
export const boardWithColumns = Prisma.validator<Prisma.BoardInclude>()({
  columns: { orderBy: { position: "asc" } },
});

// Notification fragments

/** Notification with the actor's profile - used in the notification list. */
export const notificationWithActor = Prisma.validator<Prisma.NotificationInclude>()({
  actor: { select: userProfileSelect },
});
