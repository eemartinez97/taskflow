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
  METRICS_TOKEN: z.string().min(16).optional(),
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
