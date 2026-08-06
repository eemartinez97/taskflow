import type { JSX } from "react";
import { Text } from "react-email";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export interface AccountActivatedEmailProps {
  name: string;
  loginUrl: string;
}

export function AccountActivatedEmail({
  name,
  loginUrl,
}: AccountActivatedEmailProps): JSX.Element {
  return (
    <EmailLayout previewText="Your TaskFlow account is now active">
      <Text className="text-base text-gray-700">Hi {name},</Text>
      <Text className="text-base text-gray-700">
        Your email address has been confirmed and your TaskFlow account is now active.
      </Text>
      <EmailButton href={loginUrl}>Sign in</EmailButton>
      <Text className="mt-6 text-sm text-gray-500">
        If you didn&apos;t expect this, please contact us so we can look into it.
      </Text>
    </EmailLayout>
  );
}

export default AccountActivatedEmail;
