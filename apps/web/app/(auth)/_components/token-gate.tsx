import type { JSX } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";
import { getServerTRPC } from "@/lib/trpc/server";

export type TokenGateResult = { valid: true; token: string } | { valid: false };

/**
 * Token-extraction-and-validation step behind /reset-password: pulls
 * `?token` out of `searchParams` and checks it via apps/api's
 * auth.checkResetToken (read-only - see that procedure's docblock for why a
 * GET/render must stay side-effect free) through the RSC in-process caller,
 * since this is a query, not a mutation.
 */
export async function resolveTokenGate(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<TokenGateResult> {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  if (!token) return { valid: false };

  const trpc = await getServerTRPC();
  const { valid } = await trpc.auth.checkResetToken({ token });
  return valid ? { valid: true, token } : { valid: false };
}

interface InvalidTokenCardProps {
  message: string;
  linkHref: string;
  linkLabel: string;
}

/** Shared "link invalid or expired" card for token-gated auth pages. */
export function InvalidTokenCard({
  message,
  linkHref,
  linkLabel,
}: InvalidTokenCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link invalid or expired</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">{message}</p>
        <Link href={linkHref} className="text-sm font-medium text-brand-600 hover:underline">
          {linkLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

interface TokenGateFallbackProps {
  title: string;
}

/** Shared Suspense fallback skeleton for token-gated auth pages. */
export function TokenGateFallback({ title }: TokenGateFallbackProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52 animate-pulse rounded-md bg-gray-100" />
      </CardContent>
    </Card>
  );
}
