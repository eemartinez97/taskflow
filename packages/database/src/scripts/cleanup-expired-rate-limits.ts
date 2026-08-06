import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated";

// dotenv 17 - pass quiet:true to suppress the startup log line
dotenv.config({ quiet: true });

export interface CleanupResult {
  deletedCount: number;
}

/**
 * Deletes RateLimitBucket rows whose window has already closed - see the
 * model's doc comment in schema.prisma. Without this, every distinct email
 * that ever hits register/forgot-password leaves a permanent row behind;
 * this keeps the table bounded by "recently active emails", not "all emails
 * ever seen".
 *
 * Exported as a pure function (injectable PrismaClient) so it's unit
 * testable without spinning up the CLI entrypoint below.
 */
export async function cleanupExpiredRateLimits(db: PrismaClient): Promise<CleanupResult> {
  const { count } = await db.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return { deletedCount: count };
}

/* v8 ignore start -- CLI entrypoint, exercised manually / via cron, not unit tested */
async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });
  try {
    const { deletedCount } = await cleanupExpiredRateLimits(db);
    console.log(`Cleanup complete: removed ${String(deletedCount)} expired rate limit bucket(s).`);
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  main().catch((error: unknown) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  });
}
/* v8 ignore stop */
