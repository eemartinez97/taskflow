import { z } from "zod";
import dotenv from "dotenv";

// dotenv 17: pass quiet:true to suppress the startup log line
dotenv.config({ quiet: true });

// Exported so tests can import directly - avoids duplicating schema definition
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(8000),
  API_LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEB_ORIGIN: z.url({ error: "WEB_ORIGIN must be a valid URL" }).default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
});

// Validate at startup - throw a readable Zod error if any var is missing or invalid
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

/** Single source of truth for environment checks - never use process.env.NODE_ENV directly. */
export const isProduction = (): boolean => env.NODE_ENV === "production";
export const isDevelopment = (): boolean => env.NODE_ENV === "development";
export const isTest = (): boolean => env.NODE_ENV === "test";

export type Env = typeof env;
