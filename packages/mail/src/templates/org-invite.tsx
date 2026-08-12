import type { JSX } from "react";
import { Text } from "react-email";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export interface OrgInviteEmailProps {
  orgName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresInHours: number;
  /** Switches the CTA copy - a fresh address goes to /register?invite=, an existing account to /invitations/. */
  isNewUser: boolean;
}

export function OrgInviteEmail({
  orgName,
  inviterName,
  role,
  acceptUrl,
  expiresInHours,
  isNewUser,
}: OrgInviteEmailProps): JSX.Element {
  const expiresInDays = Math.round(expiresInHours / 24);

  return (
    <EmailLayout previewText={`${inviterName} invited you to join ${orgName} on TaskFlow`}>
      <Text className="text-base text-gray-700">Hi there,</Text>
      <Text className="text-base text-gray-700">
        {inviterName} invited you to join <strong>{orgName}</strong> on TaskFlow, with the {role}{" "}
        role.
      </Text>
      <EmailButton href={acceptUrl}>
        {isNewUser ? "Create your account" : "View invitation"}
      </EmailButton>
      <Text className="mt-6 text-sm text-gray-500">
        This invitation expires in {expiresInDays} day{expiresInDays === 1 ? "" : "s"}. If you
        weren&apos;t expecting this, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default OrgInviteEmail;
