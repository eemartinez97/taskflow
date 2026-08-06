import { isResendSandboxAddress } from "@taskflow/shared";
import { ConsoleEmailSender } from "./providers/console";
import { ResendEmailSender } from "./providers/resend";
import type { EmailSender } from "./types";

export interface CreateEmailSenderOptions {
  /** Resend API key. When absent outside production, falls back to console logging. */
  resendApiKey?: string | undefined;
  /** "From" header used for every outgoing email. */
  from: string;
  isProduction: boolean;
}

/**
 * Picks the EmailSender implementation for the current environment.
 *
 * - Production: always Resend. Throws immediately if the key is missing, or
 *   if `from` is still Resend's onboarding@resend.dev sandbox address (which
 *   Resend restricts to only deliver to the account owner), so a
 *   misconfigured deploy fails at boot instead of silently dropping every
 *   outgoing email.
 * - Dev/test: Resend if a key is configured, otherwise the console fallback.
 */
export function createEmailSender(options: CreateEmailSenderOptions): EmailSender {
  if (options.isProduction) {
    if (!options.resendApiKey) {
      throw new Error("RESEND_API_KEY is required in production.");
    }
    if (isResendSandboxAddress(options.from)) {
      throw new Error(
        "EMAIL_FROM is still Resend's onboarding@resend.dev sandbox address, which cannot " +
          "deliver to real recipients - set it to a verified sending domain in production.",
      );
    }
    return new ResendEmailSender({ apiKey: options.resendApiKey, from: options.from });
  }
  if (options.resendApiKey) {
    return new ResendEmailSender({ apiKey: options.resendApiKey, from: options.from });
  }
  return new ConsoleEmailSender();
}
