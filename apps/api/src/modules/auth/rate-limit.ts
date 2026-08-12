import type { PrismaClient } from "@taskflow/database";
import { isAuthorizedE2ERequest } from "../../utils/e2e";
import { TRPCError } from "../../trpc/init";

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
 * Not an in-memory/globalThis counter for either axis: apps/api can run as
 * more than one instance, and an in-process counter would let each instance
 * grant its own separate budget (multiplying the effective limit) while also
 * resetting to zero on every redeploy. A shared row in the same database
 * every instance already talks to closes both gaps.
 *
 * The check-and-increment is a single atomic `INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING` statement, not a SELECT followed by an UPDATE - two
 * concurrent requests for the same key must not both read a stale count and
 * both decide they're under the limit.
 *
 * `db` is always the caller's `ctx.db` - never a module-scope Prisma import -
 * so tests can inject a mock without reaching into module internals.
 *
 * NOT built on top of `packages/shared`'s `RateLimiter` (the generic
 * in-memory sliding-window limiter backing `apps/api/src/socket/rate-limit.ts`)
 * despite sharing the same conceptual contract (check, refundable release
 * keyed by a window token). That interface is deliberately fully
 * SYNCHRONOUS - built for the socket-presence hot path - while every
 * operation here is a DB round-trip and therefore necessarily
 * asynchronous. Unifying them would mean making `RateLimiter` async and
 * updating every socket-layer consumer to `await` it, a cross-cutting
 * change to already-correct, performance-sensitive code that doesn't
 * belong in an auth-focused change. Tracked in BACKLOG.md - keep this
 * module's semantics (refundable release, window-token staleness check) in
 * sync with `RateLimiter`'s by comment, not by shared code, until that's
 * revisited deliberately.
 */
const AUTH_EMAIL_RATE_LIMIT = 3;
const AUTH_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const AUTH_IP_RATE_LIMIT = 10;
const AUTH_IP_WINDOW_MS = 15 * 60 * 1000;

/**
 * Login gets its OWN, stricter limits and its OWN bucket-key namespace
 * (`login-email:`/`login-ip:`, not `email:`/`ip:`) - a burst of wrong
 * passwords must not also burn the same account's register/forgot-password
 * quota, and vice versa. Tighter than the email-sending limiters above
 * because credential stuffing is a direct, unthrottled-by-mail-delivery
 * brute-force surface: `auth.verifyCredentials` is server-to-server
 * (behind `internalProcedure`) but still world-reachable through
 * apps/web's login form, so it needs its own floor independent of
 * anything upstream.
 */
const LOGIN_EMAIL_RATE_LIMIT = 5;
const LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_RATE_LIMIT = 20;
const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;

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

function loginEmailBucketKey(email: string): string {
  return `login-email:${normalizeEmail(email)}`;
}

function loginIpBucketKey(ip: string): string {
  return `login-ip:${ip}`;
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
 * Unlike src/config/env.ts's production exemption, this bypass fully
 * disables a real anti-abuse control, so it requires the SAME proof the
 * /api/test/* route guard requires (`isAuthorizedE2ERequest` in utils/e2e.ts):
 * `isE2ERun()` AND the caller's own `x-e2e-secret` header matching
 * `E2E_TEST_SECRET` in constant time - not just that env var being *present*
 * on the server. A presence-only check would bypass rate limiting for every
 * request server-wide for the whole lifetime of an E2E run (or a
 * docker-compose-style deployment that leaks both env vars), regardless of
 * whether that particular request came from the test suite; requiring the
 * header means only requests that already prove they know the per-run secret
 * skip the limiter - ordinary traffic hitting the same server during that
 * window is still rate-limited normally.
 */
async function checkRateLimitBucket(
  db: PrismaClient,
  key: string,
  limit: number,
  windowMs: number,
  e2eSecretHeader: string | null,
): Promise<RateLimitCheck> {
  if (isAuthorizedE2ERequest(e2eSecretHeader ?? undefined)) {
    return { limited: false, windowToken: E2E_BYPASS_WINDOW_TOKEN };
  }

  const now = new Date();
  const freshResetAt = new Date(now.getTime() + windowMs);

  const rows = await db.$queryRaw<RateLimitBucketRow[]>`
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
async function releaseRateLimitBucket(
  db: PrismaClient,
  key: string,
  windowToken: number | null,
): Promise<void> {
  if (windowToken === null) return;
  await db.$executeRaw`
    UPDATE "auth"."RateLimitBucket"
    SET "count" = GREATEST("count" - 1, 0)
    WHERE "key" = ${key} AND "resetAt" = ${new Date(windowToken)};
  `;
}

export async function checkAuthEmailRateLimit(
  db: PrismaClient,
  email: string,
  e2eSecretHeader: string | null,
): Promise<RateLimitCheck> {
  return checkRateLimitBucket(
    db,
    emailBucketKey(email),
    AUTH_EMAIL_RATE_LIMIT,
    AUTH_EMAIL_WINDOW_MS,
    e2eSecretHeader,
  );
}

export async function releaseAuthEmailRateLimit(
  db: PrismaClient,
  email: string,
  windowToken: number | null,
): Promise<void> {
  return releaseRateLimitBucket(db, emailBucketKey(email), windowToken);
}

export async function checkAuthIpRateLimit(
  db: PrismaClient,
  ip: string,
  e2eSecretHeader: string | null,
): Promise<RateLimitCheck> {
  return checkRateLimitBucket(
    db,
    ipBucketKey(ip),
    AUTH_IP_RATE_LIMIT,
    AUTH_IP_WINDOW_MS,
    e2eSecretHeader,
  );
}

export async function releaseAuthIpRateLimit(
  db: PrismaClient,
  ip: string,
  windowToken: number | null,
): Promise<void> {
  return releaseRateLimitBucket(db, ipBucketKey(ip), windowToken);
}

export interface AuthRateLimitState {
  emailCheck: RateLimitCheck;
  ipCheck: RateLimitCheck | null;
}

/**
 * Runs both auth axes (email + IP) and throws TOO_MANY_REQUESTS if either
 * tripped, releasing whichever axis did NOT trip first - see registerUser's
 * original docblock for why only one axis may actually be the reason for a
 * rejection while both get checked unconditionally. Shared by registerUser
 * and requestPasswordReset (service.ts) - both enforce the exact same
 * email+IP policy via checkAuthEmailRateLimit/checkAuthIpRateLimit.
 */
export async function enforceAuthRateLimit(
  db: PrismaClient,
  email: string,
  clientIp: string | null,
  e2eSecretHeader: string | null,
): Promise<AuthRateLimitState> {
  const [emailCheck, ipCheck] = await Promise.all([
    checkAuthEmailRateLimit(db, email, e2eSecretHeader),
    clientIp ? checkAuthIpRateLimit(db, clientIp, e2eSecretHeader) : null,
  ]);

  if (emailCheck.limited || ipCheck?.limited) {
    if (!emailCheck.limited) {
      await releaseAuthEmailRateLimit(db, email, emailCheck.windowToken);
    }
    if (clientIp && ipCheck && !ipCheck.limited) {
      await releaseAuthIpRateLimit(db, clientIp, ipCheck.windowToken);
    }
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again later.",
    });
  }

  return { emailCheck, ipCheck };
}

/**
 * Unconditionally refunds both axes from a prior `enforceAuthRateLimit` call -
 * call only for failures upstream of a send attempt (DB down, etc.), never
 * for an EmailDeliveryError (see registerUser's docblock on why refunding a
 * genuinely-attempted send would let an attacker farm quota by triggering
 * Resend errors).
 */
export async function releaseAuthRateLimit(
  db: PrismaClient,
  email: string,
  clientIp: string | null,
  state: AuthRateLimitState,
): Promise<void> {
  await releaseAuthEmailRateLimit(db, email, state.emailCheck.windowToken);
  if (clientIp && state.ipCheck) {
    await releaseAuthIpRateLimit(db, clientIp, state.ipCheck.windowToken);
  }
}

/**
 * No `release*` counterpart, unlike the auth-email limiters above: every
 * login attempt - right password or wrong - is a real attempt, so there's
 * no "upstream failure vs. actually-attempted" distinction to refund
 * around. A DB error mid-check still consumes the slot, by design.
 */
export async function checkLoginEmailRateLimit(
  db: PrismaClient,
  email: string,
  e2eSecretHeader: string | null,
): Promise<RateLimitCheck> {
  return checkRateLimitBucket(
    db,
    loginEmailBucketKey(email),
    LOGIN_EMAIL_RATE_LIMIT,
    LOGIN_EMAIL_WINDOW_MS,
    e2eSecretHeader,
  );
}

export async function checkLoginIpRateLimit(
  db: PrismaClient,
  ip: string,
  e2eSecretHeader: string | null,
): Promise<RateLimitCheck> {
  return checkRateLimitBucket(
    db,
    loginIpBucketKey(ip),
    LOGIN_IP_RATE_LIMIT,
    LOGIN_IP_WINDOW_MS,
    e2eSecretHeader,
  );
}
