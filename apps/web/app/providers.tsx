"use client";

import { SessionProvider } from "next-auth/react";
import type { JSX } from "react";

import { TRPCProvider } from "@/lib/trpc/client";

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
      <TRPCProvider>{children}</TRPCProvider>
    </SessionProvider>
  );
}
