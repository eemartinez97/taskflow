import { z } from "zod";

// Exported so tests can import directly - avoids duplicating schema definition
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(8000),
  API_LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEB_ORIGIN: z
    .url()
    .regex(/^https?:\/\//, "WEB_ORIGIN must start with http:// or https://")
    .default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  // Container orchestrators commonly can't express "omit this var" as
  // cleanly as a real shell - docker-compose.yml's `${METRICS_TOKEN:-}`
  // substitution always sets the key, just to "" when unset. Treat an
  // empty string the same as "not provided" so /metrics stays reachable
  // without a token in dev instead of crashing the container on boot.
  METRICS_TOKEN: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(16).optional(),
  ),
  // Number of upstream reverse proxy hops to trust (e.g. 1 for nginx in front
  // of this API). Passed straight to Express's `trust proxy` setting, which
  // uses the same "count from the right" semantics as apps/web's
  // TRUSTED_PROXY_HOPS (lib/http/client-ip.ts).
  // Defaults to 0 (trust nothing, use the raw socket address) - unlike
  // apps/web, this app has no documented standalone-behind-a-PaaS-edge
  // deployment path, so trusting a hop that isn't actually there would let a
  // client spoof X-Forwarded-For and bypass defaultRateLimiter's per-IP
  // limiting (e.g. `pnpm dev`, or any deployment that exposes this port
  // directly). docker-compose.yml sets this explicitly to 1 for the
  // nginx-fronted deployment - opt in there, don't rely on the default.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // TTL for utils/auth.ts's in-process passwordChangedAt cache - mirrors
  // apps/web's serverEnvSchema field of the same name
  // (apps/web/lib/env.ts). Must be kept configurable on BOTH apps: they run
  // this cache as two independent in-process instances (see
  // packages/shared's createPasswordChangedAtCache docblock), so lowering
  // only one side's TTL leaves the other still trusting a revoked session
  // for up to the old value.
  PASSWORD_CHANGED_AT_CACHE_TTL_MS: z.coerce.number().int().min(0).default(60_000),
});

/**
 * Pure, testable parse step. Exported so unit tests can assert every
 * validation rule without touching process.env or process.exit.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    console.error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
    process.exit(1);
  }

  return parsed.data;
}

// Validate at startup - exits with a readable Zod error if anything is invalid
export const env = parseEnv(process.env);

/** Single source of truth for environment checks - never use process.env.NODE_ENV directly. */
export const isProduction = (): boolean => env.NODE_ENV === "production";
export const isDevelopment = (): boolean => env.NODE_ENV === "development";
export const isTest = (): boolean => env.NODE_ENV === "test";

export type Env = z.infer<typeof envSchema>;
