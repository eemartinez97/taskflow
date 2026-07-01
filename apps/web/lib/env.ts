import { z } from "zod";

/**
 * Environment validation for apps/web.
 *
 * IMPORTANT - two separate schema by concern:
 *
 * `serverEnvSchema` - validated at startup on the server only.
 *  Never expose these values to the browser.
 *
 * `publicEnvSchema` - NEXT_PUBLIC_ variables baked into the client bundle.
 *  Safe to read in Client Components.
 *
 * WHY split schemas (SRP):
 * - Keeps secret/server values categorically separate from public values.
 * - Makes it easy to audit when each component may access.
 * - Prevents accidentally shipping a server secret to the client bundle.
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

// -- Validated singletons --

/**
 * Server-side validated environment.
 * Import this in Server Components, Route Handlers, and tRPC context.
 * Throws at module load time (Next.js surface it as built error).
 */
function parseServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${z.prettifyError(parsed.error)}`);
  }

  return parsed.data;
}

/**
 * Public-side validated environment.
 * Safe to import in Client Components.
 */
function parsePublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid public environment variables:\n${z.prettifyError(parsed.error)}`);
  }

  return parsed.data;
}

export const serverEnv: ServerEnv = parseServerEnv();
export const publicEnv: PublicEnv = parsePublicEnv();
