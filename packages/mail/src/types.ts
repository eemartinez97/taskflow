/** Parameters accepted by every EmailSender implementation. */
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Single-method interface (Interface Segregation) implemented by every
 * email provider. Swapping Resend for Postmark/SES later means writing one
 * new class here - zero changes in any calling code (Open/Closed).
 */
export interface EmailSender {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
