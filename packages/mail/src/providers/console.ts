import type { EmailSender, SendEmailParams, SendEmailResult } from "../types";

/**
 * Development fallback - logs the email instead of sending it.
 * Lets the full registration/reset-password flow be exercised locally
 * without a Resend account. NEVER selected in production (see factory.ts).
 */
export class ConsoleEmailSender implements EmailSender {
  send(params: SendEmailParams): Promise<SendEmailResult> {
    console.log("\n[ConsoleEmailSender] Email not actually sent (dev mode)");
    console.log(`  To:      ${params.to}`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  HTML:\n${params.html}\n`);
    return Promise.resolve({ success: true, messageId: "console-dev" });
  }
}
