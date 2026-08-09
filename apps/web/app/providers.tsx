"use client";

import { SessionProvider } from "next-auth/react";
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
 */
export function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <SessionProvider>
      <TRPCProvider>
        <NavProgressBar />
        {children}
        <Toaster />
      </TRPCProvider>
    </SessionProvider>
  );
}
