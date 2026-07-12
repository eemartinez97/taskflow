import "server-only";
import { z } from "zod";
import { type ServerEnv, serverEnvSchema } from "./env";

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

export const serverEnv: ServerEnv = parseServerEnv();
