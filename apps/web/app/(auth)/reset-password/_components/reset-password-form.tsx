import type { JSX } from "react";
import { TokenPasswordForm } from "../../_components/token-password-form";

interface ResetPasswordFormProps {
  token: string;
}

/** Sets a new password for a validated PASSWORD_RESET token. */
export function ResetPasswordForm({ token }: ResetPasswordFormProps): JSX.Element {
  return (
    <TokenPasswordForm
      token={token}
      redirectTo="/login?reset=1"
      passwordLabel="New Password"
      confirmLabel="Confirm New Password"
      submitLabel="Reset password"
    />
  );
}
