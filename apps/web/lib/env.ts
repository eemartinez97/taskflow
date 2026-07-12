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

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required" }),
  NEXTAUTH_SECRET: z.string().min(16, { error: "NEXTAUTH_SECRET must be at least 16 characters" }),
  NEXTAUTH_URL: z.url({ error: "NEXTAUTH_URL must be a valid URL" }),
});

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SOCKET_URL: z
    .url({ error: "NEXT_PUBLIC_SOCKET_URL must be a valid URL" })
    .default("http://localhost:8000"),
  NEXT_PUBLIC_WEB_URL: z
    .url({ error: "NEXT_PUBLIC_WEB_URL mist be a valid URL" })
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
