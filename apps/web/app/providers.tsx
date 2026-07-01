"use client";

import { SessionProvider } from "next-auth/react";
import type { JSX } from "react";

/**
 * Client-side provider tree.
 *
 * Mounted from app/layout.tsx (Server Component) so that all pages
 * automatically have access to the NextAuth v4 session context.
 *
 * tRPC + ReactQuery providers are added later.
 *
 * React: 19 no forwardRef, no propTypes - plain function component.
 */
export function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  return <SessionProvider>{children}</SessionProvider>;
}
