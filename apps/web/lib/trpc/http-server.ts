import "server-only";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@taskflow/api/trpc";
import superjson from "superjson";

import { publicEnv } from "../env.client";
import { serverEnv } from "../env.server";

/**
 * Server-side (not React) tRPC client that reaches the REAL apps/api
 * process over HTTP - for the handful of places SERVER-SIDE code (never a
 * browser) must call a MUTATION: auth.ts's `authorize()` and
 * verify-email/page.tsx. RSCs otherwise use lib/trpc/server.ts's in-process
 * caller, but that one only ever runs queries against a `noOpIo` - only
 * apps/api's own process owns the real Socket.IO instance and runs
 * `internalProcedure`'s secret check, so a mutation MUST go over the wire.
 *
 * Always attaches `x-internal-secret` - harmless on `publicProcedure` calls
 * (nothing reads it there), required for `internalProcedure` ones
 * (auth.verifyCredentials). Safe to send unconditionally: this module is
 * `import("server-only")`-guarded and never reaches a browser bundle.
 *
 * Also attaches `x-e2e-secret` (serverEnv.E2E_TEST_SECRET, only ever set by
 * playwright.config.ts) so auth.verifyCredentials' own rate limiting
 * (checkLoginEmailRateLimit/checkLoginIpRateLimit in apps/api's
 * rate-limit.ts) gets the same E2E bypass as auth.register - login has no
 * other path to apps/api, so without this every E2E run's logins count
 * against the real per-email/per-IP buckets, which /api/test/reset
 * deliberately does not clear (see its own docblock).
 */
/** Extracted so the header-building logic is testable without a real HTTP call. */
export function buildInternalSecretHeaders(): Record<string, string> {
  return {
    ...(serverEnv.INTERNAL_API_SECRET
      ? { "x-internal-secret": serverEnv.INTERNAL_API_SECRET }
      : {}),
    ...(serverEnv.E2E_TEST_SECRET ? { "x-e2e-secret": serverEnv.E2E_TEST_SECRET } : {}),
  };
}

export const apiHttpClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      // serverEnv.INTERNAL_API_URL, not publicEnv.NEXT_PUBLIC_API_URL - see
      // INTERNAL_API_URL's docblock in env.ts for why a server-to-server
      // call can't reuse the browser-facing origin.
      url: `${serverEnv.INTERNAL_API_URL ?? publicEnv.NEXT_PUBLIC_API_URL}/trpc`,
      transformer: superjson,
      headers: buildInternalSecretHeaders,
    }),
  ],
});
