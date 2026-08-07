import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

/**
 * Auth group layout - wraps /login, /register, /forgot-password,
 * /reset-password, and /verify-email pages.
 * Centres the TaskFlow brand mark above the card so these pages don't feel
 * orphaned from the rest of the product (they render outside the dashboard
 * shell in components/layout, which is the only other place this mark
 * appears).
 * Server Component: no hooks, no client-side state.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-gray-50 px-4">
      <Link href="/" className="flex items-center gap-2 text-2xl font-semibold text-brand-700">
        <LayoutDashboard className="h-8 w-8" />
        <span>TaskFlow</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
