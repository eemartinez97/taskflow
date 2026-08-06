import { z } from "zod";

/**
 * Auth-specific Zod schemas.
 *
 * Kept separate from packages/shared/schemas (which holds domain entities)
 * because these are web-app-only concerns - they never appear in API
 * payloads or socket events.
 *
 * Single source of truth for BOTH client-side form validation
 * (react-hook-form zodResolver) and server-side route handler validation.
 */

export const loginSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }),
  password: z.string().min(1, { error: "Password is required." }),
});

/**
 * Shared password policy - reused by every flow that sets a password
 * (complete registration, reset password) so the rules can never drift.
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

/**
 * Shared "passwords must match" check, reused by every schema below that
 * has both a `password` and a `confirmPassword` field. Kept as a plain
 * function (not a generic schema-builder) - Zod's type inference struggles
 * to resolve `.refine()` over a generic intersection shape, and this is
 * simpler anyway (KISS over a clever-but-fragile generic).
 */
function passwordsMatch(data: { password: string; confirmPassword: string }): boolean {
  return data.password === data.confirmPassword;
}
const PASSWORD_MISMATCH_ISSUE = {
  error: "Passwords do not match.",
  path: ["confirmPassword"],
};

/**
 * Registration - collects everything up front. The account is created
 * immediately with this password but stays unable to sign in
 * (`emailVerified: null`) until the emailed confirmation link is clicked -
 * see authorizeCredentials's guard and /verify-email.
 */
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
  .refine(passwordsMatch, PASSWORD_MISMATCH_ISSUE);

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { error: "Missing or invalid reset link." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH_ISSUE);

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
