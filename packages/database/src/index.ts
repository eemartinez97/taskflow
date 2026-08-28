import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated";

// PrismaClient singleton - prevents exhausting DB connections in dev (Next.js HMR)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    // test: no logs at all - expected errors (constraint checks etc.)
    //       are captured by vitest matchers, not by Prisma's logger.
    // production: only actionable alerts.
    // development: full query log for debugging.
    log: isTest ? [] : isProduction ? ["warn", "error"] : ["query", "warn", "error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

// Re-export all generated types - consumers import from "@taskflow/database"
// PrismaClient is already exported as a value above via the import
export { PrismaClient, Prisma } from "./generated";
export type * from "./generated";
export type { DefaultArgs } from "./generated/runtime/client";

// Shared types derived from query fragments
export type {
  OrgWithMembership,
  BoardWithColumns,
  MembershipWithUser,
  NotificationWithActor,
  CommentWithAuthor,
  InvitationWithOrg,
  InvitationWithInviter,
  FormerAssignee,
  DbClient,
} from "./types";

// Query fragments - consumed by repo files in apps/api
export {
  userBasicSelect,
  userProfileSelect,
  membershipWithUser,
  orgWithMembership,
  boardWithColumns,
  notificationWithActor,
  commentWithAuthor,
  invitationWithOrg,
  invitationWithInviter,
  formerAssigneeSelect,
} from "./selects";
