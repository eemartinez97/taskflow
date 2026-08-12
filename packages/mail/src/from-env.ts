import { createEmailSender } from "./factory";
import type { EmailSender } from "./types";
import type { MailEnv } from "./env";

export interface CreateEmailSenderFromEnvOptions extends MailEnv {
  isProduction: boolean;
}

/**
 * Thin adapter from an app's parsed env (spreading `mailEnvShape`) to
 * `createEmailSender`'s options shape - keeps the `RESEND_API_KEY -> resendApiKey`
 * rename and the `NODE_ENV === "production"` mapping defined once instead of
 * at every call site.
 */
export function createEmailSenderFromEnv(env: CreateEmailSenderFromEnvOptions): EmailSender {
  return createEmailSender({
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    isProduction: env.isProduction,
  });
}
