import type { PrismaClient } from "../generated";
import { runCleanupCli, type CleanupResult } from "./run-cleanup";

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

/* v8 ignore next 3 -- CLI entrypoint, exercised manually / via cron, not unit tested */
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  runCleanupCli("expired rate limit bucket(s)", cleanupExpiredRateLimits);
}
