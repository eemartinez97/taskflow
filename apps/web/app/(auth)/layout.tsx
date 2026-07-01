import type { JSX } from "react";

/**
 * Auth group layout - wraps /login and /register pages.
 * Centres content on screen and provides a subtitle background.
 * Server Component: no hooks, no client-side state.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
