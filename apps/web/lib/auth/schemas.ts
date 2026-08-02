import { z } from "zod";

/**
 * Auth-specific Zod schemas.
 *
 * Kept separate from packages/shared/schemas (which holds domain entities)
 * because login/register inputs are web-app concerns - they never appear in
 * API payloads or socket events.
 *
 * Single source of truth for BOTH client-side form validation
 * (react-hook-form zodResolver) and server-side route handler validation
 */

export const loginSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }),
  password: z.string().min(1, { error: "Password is required." }),
});

/**
 * Shared password policy - reused by register, reset-password and
 * change-password so the rules can never drift between flows.
 *
 * The 72-byte cap is a bcrypt limitation (silently truncates beyond it).
 */
export const passwordSchema = z
  .string()
  .min(10, { error: "Password must be at least 10 characters." })
  .max(72, { error: "Password must be at most 72 characters." })
  .regex(/[a-z]/, { error: "Password must include a lowercase letter." })
  .regex(/[A-Z]/, { error: "Password must include an uppercase letter." })
  .regex(/[0-9]/, { error: "Password must include a number." })
  .regex(/[^A-Za-z0-9]/, { error: "Password must include a symbol." });

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, { error: "Name must be at least 2 characters." })
      .max(100, { error: "Name must be at most 100 characters." }),
    email: z.email({ error: "Please enter a valid email address." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
