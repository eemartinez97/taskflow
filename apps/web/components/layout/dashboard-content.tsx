"use client";

import type { JSX, ReactNode } from "react";

import { useGlobalLoading } from "@/lib/hooks/use-global-loading";

/**
 * Dims the dashboard's main content area while the app is "busy" - a
 * navigation, a tRPC mutation, or a first-time query load (see
 * useGlobalLoading). Any of those already shows the top bar, so this dims
 * content too, automatically, with nothing to wire per page or per action.
 */
export function DashboardContent({ children }: { children: ReactNode }): JSX.Element {
  const active = useGlobalLoading();

  return (
    <div
      aria-busy={active}
      className={
        active
          ? "pointer-events-none opacity-50 transition-opacity duration-200"
          : "transition-opacity duration-200"
      }
    >
      {children}
    </div>
  );
}
