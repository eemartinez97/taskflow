"use client";

import { type JSX, useEffect } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@taskflow/ui";
import { api } from "@/lib/trpc/client";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Catches render errors anywhere under (dashboard) - most notably a session
 * that was valid when the request started but got revoked mid-render (see
 * apps/api's protectedProcedure / getSessionUser's passwordChangedAt check,
 * and apps/web's isSessionRevoked). Without this boundary, Next.js falls
 * back to its own blank generic error screen for the whole app.
 *
 * Next.js redacts the real server error message (and any error code) before
 * it reaches a Client Component error boundary in production - only
 * `digest` survives, as an opaque correlation id for the server log. That
 * means this can NOT distinguish "session revoked" from any other server
 * error, and must not try to. The recovery path is the same either way:
 * everything under (dashboard) requires an authenticated session, so
 * clearing it and signing in again is always a safe, correct next step
 * regardless of cause.
 *
 * Plain navigation to /login is NOT enough by itself: proxy.ts decides
 * "authenticated" from the JWT cookie alone (no revocation check, by
 * design - see its docblock), so a structurally-valid-but-revoked cookie
 * would just get bounced from /login straight back to /projects, throwing
 * again. `signOut()` clears that cookie client-side first, which is what
 * actually breaks the loop.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps): JSX.Element {
  const signOutMutation = api.auth.signOut.useMutation();

  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  function handleSignInAgain(): void {
    // Best-effort: this mutation requires the same session that may be the
    // very thing that's broken, so it can fail here too - onSettled runs
    // the actual client-side logout regardless, same pattern as the normal
    // sign-out button in components/layout/header.tsx.
    signOutMutation.mutate(undefined, {
      onSettled: () => void signOut({ callbackUrl: "/login" }),
    });
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>

      <h2 className="text-base font-semibold text-gray-800">Something went wrong</h2>
      <p className="max-w-sm text-sm text-gray-500">
        Your session may have expired. Try again, or sign in again to continue.
      </p>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
        <Button onClick={handleSignInAgain} loading={signOutMutation.isPending}>
          Sign in again
        </Button>
      </div>

      {error.digest && <p className="text-xs text-gray-400">Reference: {error.digest}</p>}
    </div>
  );
}
