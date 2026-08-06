import { Resend } from "resend";
import type { EmailSender, SendEmailParams, SendEmailResult } from "../types";

export interface ResendEmailSenderOptions {
  apiKey: string;
  /** e.g. "TaskFlow <onboarding@resend.dev>" */
  from: string;
}

/**
 * The Resend SDK's emails.send() accepts no timeout/AbortSignal option, so a
 * hung API call or network hop would otherwise block the caller (a Next.js
 * route handler) indefinitely.
 */
const SEND_TIMEOUT_MS = 10_000;

/** Production email sender backed by the Resend API. */
export class ResendEmailSender implements EmailSender {
  private readonly client: Resend;
  private readonly from: string;

  constructor(options: ResendEmailSenderOptions) {
    this.client = new Resend(options.apiKey);
    this.from = options.from;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Resend request timed out after ${SEND_TIMEOUT_MS.toString()}ms`));
      }, SEND_TIMEOUT_MS);
    });

    try {
      const { data, error } = await Promise.race([
        this.client.emails.send({
          from: this.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          ...(params.text !== undefined && { text: params.text }),
        }),
        timeout,
      ]);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, messageId: data.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
