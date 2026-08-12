import type { EmailSender } from "./types";
import { renderAndSendEmail } from "./render-and-send";
import { OrgInviteEmail } from "./templates/org-invite";

export interface SendOrgInviteEmailParams {
  to: string;
  orgName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresInHours: number;
  isNewUser: boolean;
}

/** Renders + sends the "you've been invited" message. Throws on delivery failure. */
export async function sendOrgInviteEmail(
  sender: EmailSender,
  params: SendOrgInviteEmailParams,
): Promise<void> {
  await renderAndSendEmail({
    sender,
    to: params.to,
    subject: `${params.inviterName} invited you to join ${params.orgName} on TaskFlow`,
    element: (
      <OrgInviteEmail
        orgName={params.orgName}
        inviterName={params.inviterName}
        role={params.role}
        acceptUrl={params.acceptUrl}
        expiresInHours={params.expiresInHours}
        isNewUser={params.isNewUser}
      />
    ),
    failureContext: "organization invite email",
  });
}
