import { z } from "zod";
import { emailField } from "../utils/normalize";

/**
 * Shared password policy - reused by every flow that sets a password
 * (registration, reset password) so the rules can never drift.
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
 * (`emailVerified: null`) until the emailed confirmation link is clicked.
 *
 * `email` uses `emailField()` (trim + lowercase before format validation) -
 * this is the value both the DB row and the rate limiter key get built
 * from, so it must be normalized once, at the boundary, not re-derived
 * separately by every caller.
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, { error: "Name must be at least 2 characters." })
      .max(100, { error: "Name must be at most 100 characters." }),
    email: emailField(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH_ISSUE);

export const forgotPasswordSchema = z.object({
  email: emailField(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { error: "Missing or invalid reset link." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH_ISSUE);

export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
