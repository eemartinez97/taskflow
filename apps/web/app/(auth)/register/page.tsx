import { Suspense, type JSX } from "react";
import type { Metadata } from "next";

import { TokenGateFallback } from "../_components/token-gate";
import { RegisterForm, type RegisterFormInvitePreview } from "./_components/register-form";
import { getServerTRPC } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Create your account" };

interface RegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolves the public invite preview for `?invite=<token>`, if any.
 * Silently falls back to `null` (ordinary registration, no banner) for a
 * missing, invalid, or no-longer-VALID token - a stale/leaked invite link
 * must never block someone from just registering normally.
 */
async function resolveInvitePreview(
  trpc: Awaited<ReturnType<typeof getServerTRPC>>,
  token: string,
): Promise<RegisterFormInvitePreview | null> {
  try {
    const preview = await trpc.invitations.getByTokenPublic({ token });
    return preview.state === "VALID" ? preview : null;
  } catch {
    return null;
  }
}

/**
 * Exported separately from the default export so it can be wrapped in
 * <Suspense> below - same rationale as VerifyEmailGate/ResetPasswordGate:
 * reading `searchParams` triggers a dynamic/uncached data access under
 * Next.js 16 cacheComponents, which requires a Suspense boundary.
 */
export async function RegisterGate({ searchParams }: RegisterPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const inviteToken = typeof params.invite === "string" ? params.invite : null;

  const trpc = await getServerTRPC();
  const invitePreview = inviteToken ? await resolveInvitePreview(trpc, inviteToken) : null;

  return <RegisterForm inviteToken={inviteToken} invitePreview={invitePreview} />;
}

export default function RegisterPage(props: RegisterPageProps): JSX.Element {
  return (
    <Suspense fallback={<TokenGateFallback title="Create your account" />}>
      <RegisterGate searchParams={props.searchParams} />
    </Suspense>
  );
}
