"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import type { JSX } from "react";

import { TRPCProvider } from "@/lib/trpc/client";
import { Toaster } from "@/lib/toast/toaster";
import { NavProgressBar } from "@/components/common/nav-progress-bar";

/**
 * Client-side provider tree.
 *
 * Provider order (outermost first):
 *   SessionProvider - NextAuth v4 session context
 *   TRPCProvider    - tRPC + TanStack Query + HydrationBoundary
 *
 * NavProgressBar reads useSyncExternalStore, which Cache Components treats as
 * uncached/dynamic - without a Suspense boundary that blocks every route from
 * static prerendering (see the `blocking-route` build error). It renders null
 * until a navigation starts, so `fallback={null}` is exactly its own initial
 * output - no visible difference, just lets prerendering skip past it.
 */
export function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <SessionProvider>
      <TRPCProvider>
        <Suspense fallback={null}>
          <NavProgressBar />
        </Suspense>
        {children}
        <Toaster />
      </TRPCProvider>
    </SessionProvider>
  );
}
