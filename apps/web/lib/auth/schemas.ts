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

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, { error: "Name must be at least 2 characters." })
      .max(100, { error: "Name must be at most 100 characters." }),
    email: z.email({ error: "Please enter a valid email address." }),
    password: z
      .string()
      .min(8, { error: "Password must be at least 8 characters." })
      .max(72, { error: "Password must be at most 72 characters." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
