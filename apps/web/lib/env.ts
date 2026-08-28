import { z } from "zod";

/**
 * Environment schemas for apps/web (Single Source of Truth).
 *
 * This file defines the Zod schemas and inferred types for both server and
 * public environments. It intentionally does NOT execute the validation to
 * prevent side-effects during bundling.
 *
 * Runtime validation and singleton exports are delegated to:
 * - `env.server.ts`: Enforced via `server-only` to guarantee server isolation.
 * - `env.client.ts`: Safe to import in Client Components ("use client").
 *
 * WHY split schemas (SRP & Bundle Safety):
 * - Keeps secret/server values categorically separate from public values.
 * - Prevents Next.js/Turbopack from accidentally shipping server-side
 *   validation logic or secret variables to the browser bundle.
 */

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required" }),
    NEXTAUTH_SECRET: z.string().min(16, {
      error: "NEXTAUTH_SECRET must be at least 16 characters",
    }),
    NEXTAUTH_URL: z.url().regex(/^https?:\/\//, "NEXTAUTH_URL must start with http:// or https://"),
    // Widens the NextAuth session cookie's Set-Cookie Domain attribute (e.g.
    // ".eosmin.dev") so apps/api on a sibling subdomain (api.taskflow.eosmin.dev)
    // actually receives it - by default the cookie is host-only, scoped to
    // whatever host served it (taskflow.eosmin.dev), and a cross-subdomain
    // fetch never sees it even with credentials:"include" and correct CORS.
    // Leave unset for single-host setups (e.g. localhost) - NextAuth's
    // default host-only cookie is what you want there.
    COOKIE_DOMAIN: z.string().optional(),
    // How many reverse-proxy hops sit between the public internet and this
    // process for the CURRENT deployment target - platform-agnostic on
    // purpose (this project has no confirmed single hosting provider). Used
    // by lib/http/client-ip.ts to find the one X-Forwarded-For entry that a
    // trusted hop actually appended, instead of trusting whatever the client
    // put at the front of the header. Default of 1 covers the common case of
    // a single PaaS edge (Railway, Vercel, Fly.io, Render, ...) sitting
    // directly in front of the app; raise it if a CDN or extra load balancer
    // is chained in front of that edge, or set it to 0 if the process is
    // genuinely internet-facing with no proxy at all.
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
    // TTL for lib/auth/session-revocation.ts's in-process passwordChangedAt
    // cache - see createPasswordChangedAtCache's docblock in
    // packages/shared for why this exists at all. 60s in every real
    // deployment; E2E overrides it much lower (playwright.config.ts) so
    // tests/e2e/auth.spec.ts's revocation test can wait out the REAL TTL
    // instead of a 60s one - same guarantee, not a fake/mocked shortcut.
    PASSWORD_CHANGED_AT_CACHE_TTL_MS: z.coerce.number().int().min(0).default(60_000),
    // Shared secret this app's server-side HTTP tRPC client
    // (lib/trpc/http-server.ts) sends as `x-internal-secret` to reach
    // apps/api's internalProcedure-gated auth.verifyCredentials - must be
    // byte-for-byte equal to apps/api's own INTERNAL_API_SECRET (see
    // docker-compose.yml's shared anchor). Required in production
    // (including E2E, which always builds/starts for real - see the
    // superRefine below) - login genuinely needs this working end to end,
    // unlike RESEND_API_KEY there was never a reason to exempt it.
    INTERNAL_API_SECRET: z.string().min(32).optional(),
    // Base URL lib/trpc/http-server.ts's apiHttpClient actually connects
    // to - deliberately separate from NEXT_PUBLIC_API_URL (the BROWSER-
    // facing origin). The two differ under docker-compose: the browser
    // reaches apps/api through nginx at NEXT_PUBLIC_API_URL
    // (http://localhost), but a server-to-server call made from INSIDE the
    // `web` container has no reason to route back out through nginx - and
    // "http://localhost" from inside that container means the web
    // container itself (nothing listens on its port 80), not nginx, so
    // every authorize()/verify-email call would silently fail to connect.
    // Falls back to NEXT_PUBLIC_API_URL for `pnpm dev` (both processes on
    // the bare host, where the two really are the same origin) - only
    // docker-compose.yml needs to set this explicitly, to apps/api's
    // internal docker network address (http://api:8000).
    INTERNAL_API_URL: z
      .url()
      .regex(/^https?:\/\//, "INTERNAL_API_URL must start with http:// or https://")
      .optional(),
    // Only ever set by playwright.config.ts's webServer env (both apps/api
    // and apps/web get the SAME value). Forwarded as `x-e2e-secret` by
    // lib/trpc/http-server.ts's apiHttpClient so auth.ts's authorize() ->
    // auth.verifyCredentials also gets apps/api's rate-limiter bypass
    // (rate-limit.ts) during E2E - without this, login's checkLoginEmailRateLimit/
    // checkLoginIpRateLimit apply for real, and repeated E2E runs against the
    // same local Postgres accumulate real RateLimitBucket rows (never cleared
    // by /api/test/reset - see its own docblock) until logins start failing.
    // Undefined in every real deployment - never added to .env.example.
    E2E_TEST_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;
    if (!data.INTERNAL_API_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["INTERNAL_API_SECRET"],
        message: "INTERNAL_API_SECRET is required in production.",
      });
    }
  });

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .url()
    .regex(/^https?:\/\//, "NEXT_PUBLIC_API_URL must start with http:// or https://")
    .default("http://localhost:8000"),
  NEXT_PUBLIC_WEB_URL: z
    .url()
    .regex(/^https?:\/\//, "NEXT_PUBLIC_WEB_URL must start with http:// or https://")
    .default("http://localhost:3000"),
  // Only ever set by playwright.config.ts's web webServer env, mirroring the
  // same E2E_TEST_SECRET apps/api checks in utils/e2e.ts. Lets the browser's
  // own httpBatchLink client (lib/trpc/client.tsx) send `x-e2e-secret` on
  // auth.register/requestPasswordReset so apps/api's rate limiter bypass
  // (rate-limit.ts's checkRateLimitBucket) actually applies to UI-driven
  // registration during E2E, not just the /api/test/* backdoor routes.
  // Undefined in every real deployment - never added to .env.example.
  NEXT_PUBLIC_E2E_TEST_SECRET: z.string().optional(),
});

/**
 * Merge schema - union on both schemas, used for full validation at startup.
 * Exported so test files can validate against it without importing the
 * parsed singleton (which would call process.exit on missing vars).
 */
export const fullEnvSchema = serverEnvSchema.extend(publicEnvSchema.shape);

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type FullEnv = z.infer<typeof fullEnvSchema>;
