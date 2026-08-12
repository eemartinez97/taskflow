import { Suspense, type JSX } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { InvalidTokenCard, TokenGateFallback } from "../_components/token-gate";
import { apiHttpClient } from "@/lib/trpc/http-server";

export const metadata: Metadata = { title: "Confirm your email" };

interface VerifyEmailPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolves the emailed token via apps/api's auth.verifyEmail. Falls back to
 * `{ verified: false }` on any thrown error (apps/api unreachable, network
 * blip) - same rationale as register/page.tsx's resolveInvitePreview: a
 * transient infra failure must render the ordinary "invalid or expired
 * link" UI, not crash the page with a generic error boundary.
 */
async function resolveVerification(token: string): Promise<{ verified: boolean }> {
  try {
    return await apiHttpClient.auth.verifyEmail.mutate({ token });
  } catch {
    return { verified: false };
  }
}

/**
 * Reached from the emailed confirmation link sent at registration. Consumes
 * the token via apps/api's auth.verifyEmail (a real HTTP call - see
 * lib/trpc/http-server.ts's docblock for why this can't be the RSC
 * in-process caller) and redirects to /login - opening the link is enough,
 * there is no separate confirm click. The "your account is active"
 * notification email and its best-effort/fire-and-forget semantics now
 * live entirely in apps/api's service (see its docblock there).
 *
 * Exported separately from the default export so it can be wrapped in
 * <Suspense> below - reading `searchParams` + making this call triggers a
 * dynamic/uncached data access under Next.js 16 cacheComponents, which
 * requires a Suspense boundary.
 */
export async function VerifyEmailGate({
  searchParams,
}: VerifyEmailPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const result = token ? await resolveVerification(token) : { verified: false as const };

  if (!result.verified) {
    return (
      <InvalidTokenCard
        message="This confirmation link is invalid or has expired. Register again to receive a new one."
        linkHref="/register"
        linkLabel="Back to registration"
      />
    );
  }

  redirect("/login?activated=1");
}

export default function VerifyEmailPage(props: VerifyEmailPageProps): JSX.Element {
  return (
    <Suspense fallback={<TokenGateFallback title="Confirm your email" />}>
      <VerifyEmailGate searchParams={props.searchParams} />
    </Suspense>
  );
}
