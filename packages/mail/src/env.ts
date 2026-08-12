import { z } from "zod";

// The "Name <email>" form requires BOTH brackets, not each independently
// optional - `<?...>?` would let "Name <email" or "Name email>" (missing one
// bracket) pass here and only fail later at Resend's own send-time
// validation, defeating the point of validating this at boot.
const EMAIL_FROM_REGEX =
  /^(?:[^<>]+\s<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

/**
 * Shared Zod shape for the two env vars every mail-sending process needs.
 * Spread into each app's own env schema (`z.object({ ...other, ...mailEnvShape })`)
 * instead of redefining the regex/default in every consumer - see
 * `createEmailSenderFromEnv` in `from-env.ts` for the matching factory half.
 */
export const mailEnvShape = {
  // Optional: createEmailSenderFromEnv falls back to a console logger when
  // this is absent. Each consuming app's own schema is responsible for
  // requiring it in production (the production/E2E distinction differs per
  // app, e.g. apps/web's isE2ERun()).
  RESEND_API_KEY: z.string().min(1).optional(),
  // Defaults to Resend's sandbox address so local dev never needs a real
  // Resend account. createEmailSender rejects this same sandbox value in
  // production.
  EMAIL_FROM: z
    .string()
    .regex(EMAIL_FROM_REGEX, { error: 'EMAIL_FROM must be an email or "Name <email>" format' })
    .default("TaskFlow <onboarding@resend.dev>"),
};

export type MailEnv = z.infer<z.ZodObject<typeof mailEnvShape>>;
