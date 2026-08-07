import "server-only";
import { prisma } from "@taskflow/database";
import { isE2ERun } from "@/lib/utils/local-database";

/**
 * Rate limits auth email endpoints (resend verification, forgot password)
 * along TWO independent axes, both backed by the same Postgres bucket table
 * (see its doc comment in schema.prisma):
 *
 * - Per EMAIL (`checkAuthEmailRateLimit`): 3 requests / 15 min. Bounds abuse
 *   AGAINST one target address (e.g. spamming a victim's inbox), regardless
 *   of who's sending the requests.
 * - Per IP (`checkAuthIpRateLimit`): 10 requests / 15 min. Bounds abuse FROM
 *   one actor - the per-email limit alone doesn't stop a single actor from
 *   cycling through many different target emails, since each one gets its
 *   own fresh per-email budget. The IP limit is deliberately more generous
 *   than the email limit: a shared IP (office network, mobile carrier NAT)
 *   can represent many unrelated legitimate users, so it needs enough
 *   headroom not to collide with normal traffic while still capping
 *   volumetric abuse.
 *
 * Not an in-memory/globalThis counter for either axis: apps/web can run as
 * more than one instance, and an in-process counter would let each instance
 * grant its own separate budget (multiplying the effective limit) while also
 * resetting to zero on every redeploy. A shared row in the same database
 * every instance already talks to closes both gaps.
 *
 * The check-and-increment is a single atomic `INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING` statement, not a SELECT followed by an UPDATE - two
 * concurrent requests for the same key must not both read a stale count and
 * both decide they're under the limit.
 */
const AUTH_EMAIL_RATE_LIMIT = 3;
const AUTH_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const AUTH_IP_RATE_LIMIT = 10;
const AUTH_IP_WINDOW_MS = 15 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Bucket keys are prefixed by axis (`email:`/`ip:`) so the two limiters can
 * never collide even in the pathological case of a key that happens to
 * match both a normalized email and a raw IP string.
 */
function emailBucketKey(email: string): string {
  return `email:${normalizeEmail(email)}`;
}

function ipBucketKey(ip: string): string {
  return `ip:${ip}`;
}

export interface RateLimitCheck {
  /** true when this request pushed the bucket over its limit for its current window. */
  limited: boolean;
  /**
   * Opaque handle identifying the window this check landed in. Pass to the
   * matching `release*` function if the caller's action ultimately fails, so
   * a release that runs after this window has already rolled over safely
   * no-ops instead of stealing quota from an unrelated later request.
   */
  windowToken: number;
}

interface RateLimitBucketRow {
  count: number;
  resetAt: Date;
}

/** Never a real bucket's resetAt - a subsequent release() call for this token safely matches zero rows. */
const E2E_BYPASS_WINDOW_TOKEN = -1;

/**
 * Atomically increments (or opens a fresh) window for `key` and reports
 * whether it's now over `limit` for that window. Shared core for both the
 * email and IP axes above - only the key/limit/window differ between them.
 *
 * Skipped entirely (no DB write at all) during a real E2E run. Without this,
 * `playwright test --repeat-each=N` (or just running the full suite several
 * times in the same 15-minute window) inevitably trips this exact limiter:
 * it's a correct anti-abuse control doing its job against traffic that
 * happens to be authorized test traffic, not a bug in the limiter itself.
 *
 * Unlike the other three isE2ERun() call sites (test-route-guard.ts,
 * lib/mail/sender.ts, env.ts's production exemption), this bypass fully
 * disables a real anti-abuse control app-wide, not just test-scoped surface
 * area - so it additionally requires E2E_TEST_SECRET to be present, the same
 * per-run random secret test-route-guard.ts checks, generated fresh by
 * playwright.config.ts and never written to any deployment's env (see that
 * file's own docblock). isE2ERun()'s local-database half already means a
 * leaked ENABLE_TEST_ROUTES flag alone can't trigger this in a database that
 * isn't local - this third factor closes the remaining gap for a
 * docker-compose-style deployment, whose DB host is literally named
 * "postgres" (one of isE2ERun's local-database hostnames).
 */
async function checkRateLimitBucket(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitCheck> {
  if (isE2ERun() && process.env.E2E_TEST_SECRET) {
    return { limited: false, windowToken: E2E_BYPASS_WINDOW_TOKEN };
  }

  const now = new Date();
  const freshResetAt = new Date(now.getTime() + windowMs);

  const rows = await prisma.$queryRaw<RateLimitBucketRow[]>`
    INSERT INTO "auth"."RateLimitBucket" AS t ("key", "count", "resetAt")
    VALUES (${key}, 1, ${freshResetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN t."resetAt" <= ${now} THEN 1 ELSE t."count" + 1 END,
      "resetAt" = CASE WHEN t."resetAt" <= ${now} THEN ${freshResetAt} ELSE t."resetAt" END
    RETURNING "count", "resetAt";
  `;

  const row = rows[0];
  if (!row) {
    // INSERT ... ON CONFLICT DO UPDATE ... RETURNING always returns exactly
    // one row for a single-row VALUES list - unreachable in practice, but
    // keeps the return type honest without a non-null assertion.
    throw new Error("RateLimitBucket upsert returned no row");
  }

  return { limited: row.count > limit, windowToken: row.resetAt.getTime() };
}

/**
 * Gives back the quota consumed by `checkRateLimitBucket` for `key`, but
 * only if `windowToken` still matches the bucket's current window - see
 * `RateLimitCheck`'s docblock. Call when the request that consumed it
 * ultimately failed (DB error, email delivery failure) so an infra hiccup
 * doesn't also lock the caller out of their next legitimate attempts.
 */
async function releaseRateLimitBucket(key: string, windowToken: number | null): Promise<void> {
  if (windowToken === null) return;
  await prisma.$executeRaw`
    UPDATE "auth"."RateLimitBucket"
    SET "count" = GREATEST("count" - 1, 0)
    WHERE "key" = ${key} AND "resetAt" = ${new Date(windowToken)};
  `;
}

export async function checkAuthEmailRateLimit(email: string): Promise<RateLimitCheck> {
  return checkRateLimitBucket(emailBucketKey(email), AUTH_EMAIL_RATE_LIMIT, AUTH_EMAIL_WINDOW_MS);
}

export async function releaseAuthEmailRateLimit(
  email: string,
  windowToken: number | null,
): Promise<void> {
  return releaseRateLimitBucket(emailBucketKey(email), windowToken);
}

export async function checkAuthIpRateLimit(ip: string): Promise<RateLimitCheck> {
  return checkRateLimitBucket(ipBucketKey(ip), AUTH_IP_RATE_LIMIT, AUTH_IP_WINDOW_MS);
}

export async function releaseAuthIpRateLimit(
  ip: string,
  windowToken: number | null,
): Promise<void> {
  return releaseRateLimitBucket(ipBucketKey(ip), windowToken);
}

/** Exposed for tests. */
export async function resetAuthEmailRateLimit(): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({});
}
