import type { EmailSender } from "./types";
import { renderAndSendEmail } from "./render-and-send";
import { ResetPasswordEmail } from "./templates/reset-password";

export interface SendPasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
  expiresInHours: number;
}

/** Renders + sends the "reset your password" message. Throws on delivery failure. */
export async function sendPasswordResetEmail(
  sender: EmailSender,
  params: SendPasswordResetEmailParams,
): Promise<void> {
  await renderAndSendEmail({
    sender,
    to: params.to,
    subject: "Reset your password",
    element: (
      <ResetPasswordEmail
        name={params.name}
        resetUrl={params.resetUrl}
        expiresInHours={params.expiresInHours}
      />
    ),
    failureContext: "password reset email",
  });
}
