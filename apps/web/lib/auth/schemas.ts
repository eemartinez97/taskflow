import { z } from "zod";

/**
 * Auth-specific Zod schemas that stay web-app-only.
 *
 * registerSchema, forgotPasswordSchema, resetPasswordSchema, and
 * passwordSchema moved to packages/shared/src/schemas/auth.ts - apps/api's
 * tRPC procedures validate against them too now, so they can't live here
 * anymore. loginSchema stays: it only ever validates the login FORM's local
 * UI state (NextAuth's `signIn("credentials", ...)` never runs it
 * server-side), so it has no reason to be shared.
 */
export const loginSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }),
  password: z.string().min(1, { error: "Password is required." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
