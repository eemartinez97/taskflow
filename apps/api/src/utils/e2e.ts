import { timingSafeEqual } from "node:crypto";

/**
 * Hostnames that identify a LOCAL Postgres instance (see docker-compose.yml
 * and .env.example's default DATABASE_URL). Mirrors apps/web's
 * lib/utils/local-database.ts - kept as two copies (one per app) rather than
 * a shared package export because it reads process.env.DATABASE_URL directly
 * and has no other reason to be part of either app's public surface.
 */
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "postgres"]);

/**
 * True only when DATABASE_URL points at a local Postgres instance. A real
 * deployment always connects to a remote-hosted database. Fails closed on a
 * malformed or missing DATABASE_URL.
 */
export function isLocalDatabase(): boolean {
  try {
    return LOCAL_DATABASE_HOSTS.has(new URL(process.env.DATABASE_URL ?? "").hostname);
  } catch {
    return false;
  }
}

/**
 * True only when BOTH ENABLE_TEST_ROUTES=true AND the app is connected to a
 * local database - the single definition of "this is an E2E run", shared by
 * the mail sender's in-memory fallback (src/mail/sender.ts) and the
 * production env-validation exemption (src/config/env.ts). A leaked
 * ENABLE_TEST_ROUTES flag alone can't silently widen either behavior in a
 * real deployment, since neither treats a remote-database connection as a
 * test run no matter what that one flag says.
 */
export function isE2ERun(): boolean {
  return process.env.ENABLE_TEST_ROUTES === "true" && isLocalDatabase();
}

export const E2E_SECRET_HEADER = "x-e2e-secret";

/**
 * Constant-time string comparison. Buffer.from + length check first (a
 * length mismatch is an unavoidable, low-value leak - it doesn't help guess
 * byte content) so timingSafeEqual only ever runs on equal-length buffers,
 * which is a hard requirement of the API. Exported so every constant-time
 * secret comparison in this app (this module's own E2E header check,
 * trpc/procedures.ts's `x-internal-secret` check) shares one implementation.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Second gate on the /api/test/* backdoor routes, on top of `isE2ERun()`.
 *
 * TWO independent checks, both required:
 * 1. `isE2ERun()` - see its own docblock. A NODE_ENV !== "production" check
 *    is deliberately NOT used instead: E2E runs against a real production
 *    build/start, which forces NODE_ENV=production regardless of any other
 *    env var, so that check would make these routes unreachable during E2E
 *    itself - defeating their purpose.
 * 2. An `x-e2e-secret` header matching E2E_TEST_SECRET, compared in
 *    constant time. This is defense-in-depth against check 1 alone: a
 *    per-run random secret, known only to playwright.config.ts and never
 *    written to any deployment's env, means a leaked flag/local-DB
 *    combination is still not enough on its own to reach these routes.
 */
export function isAuthorizedE2ERequest(headerValue: string | undefined): boolean {
  if (!isE2ERun()) return false;
  const secret = process.env.E2E_TEST_SECRET;
  return !!secret && !!headerValue && timingSafeEqualStrings(secret, headerValue);
}
