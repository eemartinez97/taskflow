import { Suspense, type JSX } from "react";
import type { Metadata } from "next";
import { prisma } from "@taskflow/database";
import { Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";
import { InvalidTokenCard, resolveTokenGate, TokenGateFallback } from "../_components/token-gate";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const metadata: Metadata = { title: "Reset your password" };

interface ResetPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Reached from the emailed password-reset link.
 *
 * Exported separately from the default export so it can be wrapped in
 * <Suspense> below - same rationale as VerifyEmailGate. Token
 * extraction/validation is shared via `resolveTokenGate`; this only owns
 * the page-specific rendering (the new-password form vs. an invalid state).
 */
export async function ResetPasswordGate({
  searchParams,
}: ResetPasswordPageProps): Promise<JSX.Element> {
  const gate = await resolveTokenGate(prisma, searchParams, "PASSWORD_RESET");

  if (!gate.valid) {
    return (
      <InvalidTokenCard
        message="This password reset link is invalid or has expired. Request a new one below."
        linkHref="/forgot-password"
        linkLabel="Request a new link"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={gate.token} />
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage(props: ResetPasswordPageProps): JSX.Element {
  return (
    <Suspense fallback={<TokenGateFallback title="Reset your password" />}>
      <ResetPasswordGate searchParams={props.searchParams} />
    </Suspense>
  );
}
