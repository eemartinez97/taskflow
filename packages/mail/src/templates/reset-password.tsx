import type { JSX } from "react";
import { Text } from "react-email";
import { EmailButton } from "./components/email-button";
import { EmailLayout } from "./components/email-layout";

export interface ResetPasswordEmailProps {
  name: string;
  resetUrl: string;
  expiresInHours: number;
}

export function ResetPasswordEmail({
  name,
  resetUrl,
  expiresInHours,
}: ResetPasswordEmailProps): JSX.Element {
  return (
    <EmailLayout previewText="Reset your TaskFlow password">
      <Text className="text-base text-gray-700">Hi {name},</Text>
      <Text className="text-base text-gray-700">
        We received a request to reset your TaskFlow password. Click the button below to choose a
        new one.
      </Text>
      <EmailButton href={resetUrl}>Reset password</EmailButton>
      <Text className="mt-6 text-sm text-gray-500">
        This link expires in {expiresInHours} hour{expiresInHours === 1 ? "" : "s"}. If you
        didn&apos;t request this, you can safely ignore this email - your password will not change.
      </Text>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;
