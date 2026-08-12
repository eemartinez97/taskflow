import { z } from "zod";
import { mailEnvShape } from "@taskflow/mail";
import { isResendSandboxAddress } from "@taskflow/shared";
import { isE2ERun } from "../utils/e2e";

// Container orchestrators commonly can't express "omit this var" as cleanly
// as a real shell - docker-compose.yml's `${VAR:-}` substitution always sets
// the key, just to "" when unset. Treat an empty string the same as "not
// provided" so optional secrets don't fail their `.min()` check in dev.
const emptyStringToUndefined = (val: unknown): unknown => (val === "" ? undefined : val);

// Exported so tests can import directly - avoids duplicating schema definition
export const envSchema = z
  .object({
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
    METRICS_TOKEN: z.preprocess(emptyStringToUndefined, z.string().min(16).optional()),
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
    // RESEND_API_KEY, EMAIL_FROM: see packages/mail's mailEnvShape - the same
    // shape apps/web spreads into its own schema, so the two apps can never
    // define this contract differently. RESEND_API_KEY additionally gets the
    // empty-string preprocess here (docker-compose.yml always sets the key),
    // which apps/web doesn't need since Vercel/`.env.local` omit unset vars
    // entirely instead of setting them to "".
    ...mailEnvShape,
    RESEND_API_KEY: z.preprocess(emptyStringToUndefined, mailEnvShape.RESEND_API_KEY),
    // Shared secret gating `internalProcedure` (src/trpc/procedures.ts) -
    // apps/web's server-side HTTP tRPC client is the only holder, it never
    // reaches a browser. Optional outside production so local dev doesn't
    // need it set; required in production - see the superRefine below.
    INTERNAL_API_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().min(32, "INTERNAL_API_SECRET must be at least 32 characters").optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;
    // INTERNAL_API_SECRET is checked unconditionally, even during E2E: it
    // gates internalProcedure (see procedures.ts), not the mail-sending path
    // below, and playwright.config.ts always sets a real value for both the
    // apps/api and apps/web webServer processes - there's no E2E scenario
    // that legitimately needs to boot without it. Skipping this check for
    // any isE2ERun() deployment (ENABLE_TEST_ROUTES=true + local database)
    // would let internalProcedure boot with no secret enforced in
    // production - see src/trpc/procedures.ts's requireInternalSecret.
    if (!data.INTERNAL_API_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["INTERNAL_API_SECRET"],
        message: "INTERNAL_API_SECRET is required in production.",
      });
    }
    // E2E always runs against a real production build, which forces
    // NODE_ENV=production regardless of any other env var - see
    // src/utils/e2e.ts's isE2ERun() docblock for why it requires BOTH
    // ENABLE_TEST_ROUTES=true AND a local database connection. The mail
    // sender falls back to an in-memory/console implementation during E2E
    // (src/mail/sender.ts), so a real Resend key/verified sender is the only
    // pair of checks this exemption may skip.
    if (isE2ERun()) return;
    if (!data.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required in production.",
      });
    }
    if (isResendSandboxAddress(data.EMAIL_FROM)) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message:
          "EMAIL_FROM must not be Resend's onboarding@resend.dev sandbox address in " +
          "production - set it to a verified sending domain.",
      });
    }
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
