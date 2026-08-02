import { z } from "zod";
import { type PublicEnv, publicEnvSchema } from "./env";

/**
 * Public-side validated environment.
 * Safe to import in Client Components.
 */
function parsePublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid public environment variables:\n${z.prettifyError(parsed.error)}`);
  }

  return parsed.data;
}

export const publicEnv: PublicEnv = parsePublicEnv();
