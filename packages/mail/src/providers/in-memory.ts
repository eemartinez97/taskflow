import type { EmailSender, SendEmailParams, SendEmailResult } from "../types";

export interface SentEmail extends SendEmailParams {
  sentAt: Date;
}

/**
 * Test-only EmailSender that captures every send() call in memory instead
 * of delivering anything. Used exclusively by the E2E suite (gated behind
 * ENABLE_TEST_ROUTES - see apps/web/lib/mail/sender.ts) so Playwright can
 * retrieve a verification/reset link without a real mailbox.
 */
export class InMemoryEmailSender implements EmailSender {
  private readonly sent: SentEmail[] = [];

  send(params: SendEmailParams): Promise<SendEmailResult> {
    this.sent.push({ ...params, sentAt: new Date() });
    return Promise.resolve({ success: true, messageId: `memory-${String(this.sent.length)}` });
  }

  /** Most recent email sent to `to`, or null when none was captured. */
  findLastEmailTo(to: string): SentEmail | null {
    return [...this.sent].reverse().find((email) => email.to === to) ?? null;
  }

  /** Exposed for test isolation between spec files. */
  clear(): void {
    this.sent.length = 0;
  }
}
