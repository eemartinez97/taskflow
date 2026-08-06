import type { JSX } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";
import type { AuthTokenType, PrismaClient } from "@taskflow/database";
import { findValidAuthToken } from "@/lib/auth/tokens";

export type TokenGateResult = { valid: true; token: string } | { valid: false };

/**
 * Shared token-extraction-and-validation step behind both /reset-password
 * and /verify-email: pulls `?token` out of `searchParams` and checks it with
 * `findValidAuthToken` (read-only - see that function's docblock for why a
 * GET/render must stay side-effect free). Each page still owns its own
 * rendering (different form, different invalid-state copy) - this only
 * removes the token-extraction/validation logic the two pages used to
 * duplicate verbatim.
 */
export async function resolveTokenGate(
  db: PrismaClient,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  tokenType: AuthTokenType,
): Promise<TokenGateResult> {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const validToken = token ? await findValidAuthToken(db, token, tokenType) : null;
  if (!token || !validToken) return { valid: false };
  return { valid: true, token };
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
