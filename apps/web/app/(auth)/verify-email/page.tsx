import { Suspense, type JSX } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";
import { prisma } from "@taskflow/database";
import { sendAccountActivatedEmail } from "@taskflow/mail";
import { InvalidTokenCard, TokenGateFallback } from "../_components/token-gate";
import { verifyEmailFromToken } from "@/lib/auth/tokens";
import { emailSender } from "@/lib/mail/sender";
import { serverEnv } from "@/lib/env.server";

export const metadata: Metadata = { title: "Confirm your email" };

interface VerifyEmailPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Sends the "your account is active" notification for a freshly-activated
 * account. Best-effort: activation already happened by the time this runs,
 * so a delivery failure here must never turn into an error page for the
 * user - it's only logged. Not called for a repeat visit to an
 * already-consumed link (see `freshlyActivated` in verifyEmailFromToken's
 * docblock), so this fires at most once per account.
 *
 * Scheduled via next/server's `after()` (see the call site below) rather
 * than awaited - the redirect to /login must not wait on an outbound email
 * API call. Sending it still isn't truly free: Suspense has to flush the
 * fallback skeleton and stream a client-side redirect once this async
 * component resolves (a plain HTTP 30x isn't possible once headers are
 * already sent), so the DB work above still gates how soon that redirect
 * fires - `after()` only removes the *email's* latency from that path.
 */
async function notifyAccountActivated(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return;

    await sendAccountActivatedEmail(emailSender, {
      to: user.email,
      name: user.name ?? user.email,
      loginUrl: `${serverEnv.NEXTAUTH_URL}/login`,
    });
  } catch (error) {
    console.error("[VerifyEmailGate] failed to send account-activated email:", error);
  }
}

/**
 * Reached from the emailed confirmation link sent at registration. Verifies
 * the account right here on GET and redirects to /login - opening the link
 * is enough, there is no separate confirm click. See
 * `verifyEmailFromToken`'s docblock for why consuming on GET is safe here.
 *
 * Exported separately from the default export so it can be wrapped in
 * <Suspense> below - reading `searchParams` + querying Prisma triggers a
 * dynamic/uncached data access under Next.js 16 cacheComponents, which
 * requires a Suspense boundary.
 */
export async function VerifyEmailGate({
  searchParams,
}: VerifyEmailPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const result = token ? await verifyEmailFromToken(prisma, token) : { verified: false as const };

  if (!result.verified) {
    return (
      <InvalidTokenCard
        message="This confirmation link is invalid or has expired. Register again to receive a new one."
        linkHref="/register"
        linkLabel="Back to registration"
      />
    );
  }

  if (result.freshlyActivated) {
    after(() => notifyAccountActivated(result.userId));
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
