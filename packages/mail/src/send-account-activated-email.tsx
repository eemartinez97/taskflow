import type { EmailSender } from "./types";
import { renderAndSendEmail } from "./render-and-send";
import { AccountActivatedEmail } from "./templates/account-activated";

export interface SendAccountActivatedEmailParams {
  to: string;
  name: string;
  loginUrl: string;
}

/** Renders + sends the "your account is active" notification. Throws on delivery failure. */
export async function sendAccountActivatedEmail(
  sender: EmailSender,
  params: SendAccountActivatedEmailParams,
): Promise<void> {
  await renderAndSendEmail({
    sender,
    to: params.to,
    subject: "Your TaskFlow account is active",
    element: <AccountActivatedEmail name={params.name} loginUrl={params.loginUrl} />,
    failureContext: "account activated email",
  });
}
