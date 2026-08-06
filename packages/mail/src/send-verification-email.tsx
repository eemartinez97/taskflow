import type { EmailSender } from "./types";
import { renderAndSendEmail } from "./render-and-send";
import { VerifyEmail } from "./templates/verify-email";

export interface SendVerificationEmailParams {
  to: string;
  name: string;
  verifyUrl: string;
  expiresInHours: number;
}

/** Renders + sends the "confirm your email" message. Throws on delivery failure. */
export async function sendVerificationEmail(
  sender: EmailSender,
  params: SendVerificationEmailParams,
): Promise<void> {
  await renderAndSendEmail({
    sender,
    to: params.to,
    subject: "Confirm your email address",
    element: (
      <VerifyEmail
        name={params.name}
        verifyUrl={params.verifyUrl}
        expiresInHours={params.expiresInHours}
      />
    ),
    failureContext: "verification email",
  });
}
