import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated";

// PrismaClient singleton - prevents exhausting DB connections in dev (Next.js HMR)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const isProduction = process.env.NODE_ENV === "production";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: isProduction ? ["warn", "error"] : ["query", "warn", "error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

// Re-export all generated types - consumers import from "@taskflow/database"
// PrismaClient is already exported as a value above via the import
export { PrismaClient } from "./generated";
export type * from "./generated";
export type { DefaultArgs } from "./generated/runtime/client";

// Shared types derived from query fragments
export type {
  OrgWithMembership,
  BoardWithColumns,
  MembershipWithUser,
  NotificationWithActor,
} from "./types";

// Query fragments - consumed by repo files in apps/api
export {
  userBasicSelect,
  userProfileSelect,
  membershipWithUser,
  orgWithMembership,
  boardWithColumns,
  notificationWithActor,
} from "./selects";
