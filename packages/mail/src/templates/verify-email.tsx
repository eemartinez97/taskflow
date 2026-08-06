import type { JSX } from "react";
import { Text } from "react-email";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export interface VerifyEmailProps {
  name: string;
  verifyUrl: string;
  expiresInHours: number;
}

export function VerifyEmail({ name, verifyUrl, expiresInHours }: VerifyEmailProps): JSX.Element {
  return (
    <EmailLayout previewText="Confirm your email to activate your TaskFlow account">
      <Text className="text-base text-gray-700">Hi {name},</Text>
      <Text className="text-base text-gray-700">
        Thanks for signing up for TaskFlow. Confirm your email address to activate your account
        and sign in.
      </Text>
      <EmailButton href={verifyUrl}>Confirm email address</EmailButton>
      <Text className="mt-6 text-sm text-gray-500">
        This link expires in {expiresInHours} hour{expiresInHours === 1 ? "" : "s"}. If you
        didn&apos;t create a TaskFlow account, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default VerifyEmail;
