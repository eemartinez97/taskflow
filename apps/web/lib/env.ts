import { z } from "zod";
import { isResendSandboxAddress } from "@taskflow/shared";
import { isE2ERun } from "@/lib/utils/local-database";

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

// The "Name <email>" form requires BOTH brackets, not each independently
// optional - `<?...>?` would let "Name <email" or "Name email>" (missing one
// bracket) pass here and only fail later at Resend's own send-time
// validation, defeating the point of validating this at boot.
const EMAIL_FROM_REGEX =
  /^(?:[^<>]+\s<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required" }),
    NEXTAUTH_SECRET: z.string().min(16, {
      error: "NEXTAUTH_SECRET must be at least 16 characters",
    }),
    NEXTAUTH_URL: z.url().regex(/^https?:\/\//, "NEXTAUTH_URL must start with http:// or https://"),
    // Optional in dev/test: @taskflow/mail's createEmailSender falls back to a
    // console logger when this is absent. Required in production - see the
    // superRefine below.
    RESEND_API_KEY: z.string().min(1).optional(),
    // Defaults to Resend's sandbox address so local dev never needs a real
    // Resend account. The superRefine below rejects this same sandbox value
    // in production, so a deploy that never set EMAIL_FROM fails at env
    // validation instead of silently shipping an address that can't deliver
    // to real recipients.
    EMAIL_FROM: z
      .string()
      .regex(EMAIL_FROM_REGEX, { error: 'EMAIL_FROM must be an email or "Name <email>" format' })
      .default("TaskFlow <onboarding@resend.dev>"),
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
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;
    // E2E always runs against a real production build (`next build && next
    // start` - see playwright.config.ts's own comment on this), which forces
    // NODE_ENV=production regardless of any other env var. isE2ERun() is the
    // single shared definition of "this is an E2E run" (also used by
    // lib/http/test-route-guard.ts and lib/mail/sender.ts) - it requires
    // BOTH ENABLE_TEST_ROUTES=true AND a local database connection, so a
    // leaked ENABLE_TEST_ROUTES flag in a real deployment (a remote
    // database) still hits these checks instead of silently skipping them.
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

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .url()
    .regex(/^https?:\/\//, "NEXT_PUBLIC_API_URL must start with http:// or https://")
    .default("http://localhost:8000"),
  NEXT_PUBLIC_WEB_URL: z
    .url()
    .regex(/^https?:\/\//, "NEXT_PUBLIC_WEB_URL must start with http:// or https://")
    .default("http://localhost:3000"),
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
