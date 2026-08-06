import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isE2ERun } from "@/lib/utils/local-database";

const SECRET_HEADER = "x-e2e-secret";

/**
 * Constant-time string comparison. Buffer.from + length check first (a
 * length mismatch is an unavoidable, low-value leak - it doesn't help guess
 * byte content) so timingSafeEqual only ever runs on equal-length buffers,
 * which is a hard requirement of the API.
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Shared 404 guard for the E2E-only /api/test/* backdoor routes.
 *
 * TWO independent checks, both required:
 * 1. `isE2ERun()` - ENABLE_TEST_ROUTES=true (only ever injected by
 *    playwright.config.ts's webServer env) AND connected to a local
 *    database. A NODE_ENV !== "production" check is deliberately NOT used
 *    instead: E2E runs against a full production build (`next build && next
 *    start`), which forces NODE_ENV=production regardless of any other env
 *    var, so that check would make these routes unreachable during E2E
 *    itself - defeating their purpose. The local-database half is itself a
 *    structural safety net independent of the env var: even if
 *    ENABLE_TEST_ROUTES leaks into a real deployment, a real deployment's
 *    DATABASE_URL is never a local Postgres host, so these routes still
 *    404 there - see `isE2ERun`'s docblock.
 * 2. An `x-e2e-secret` header matching E2E_TEST_SECRET, compared in constant
 *    time. This is defense-in-depth against check 1 alone: a per-run random
 *    secret, known only to playwright.config.ts and never written to any
 *    deployment's env, means a leaked flag/local-DB combination is still not
 *    enough on its own to reach these routes.
 *
 * Callers must `await connection()` first to opt the route out of static
 * caching under cacheComponents - see last-email/route.ts for the full
 * rationale.
 */
export function testRouteGuardResponse(req: NextRequest): NextResponse | null {
  const notFound = (): NextResponse => NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!isE2ERun()) return notFound();

  const secret = process.env.E2E_TEST_SECRET;
  const provided = req.headers.get(SECRET_HEADER);
  if (!secret || !provided || !timingSafeEqualStrings(secret, provided)) return notFound();

  return null;
}
