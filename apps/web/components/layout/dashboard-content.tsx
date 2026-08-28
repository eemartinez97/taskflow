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
      // h-full: without it, this div (a plain block box with no height of
      // its own) breaks the height chain a page like the Kanban board
      // relies on - layout.tsx's <main> has a real height (flex-1 inside
      // h-screen), but percentage heights below THIS div (page.tsx's own
      // `h-full flex-col`, and everything KanbanBoard nests under it)
      // resolve against an "auto" parent and collapse to content size
      // instead. Harmless for ordinary pages: a taller child still
      // overflows this div's box normally, and <main>'s own
      // overflow-y-auto still scrolls to reveal it.
      className={
        active
          ? "h-full pointer-events-none opacity-50 transition-opacity duration-200"
          : "h-full transition-opacity duration-200"
      }
    >
      {children}
    </div>
  );
}
