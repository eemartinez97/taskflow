import type { JSX } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { requireSession } from "@/lib/auth/session";
import { Header } from "@/components/layout/header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params?: Promise<Record<string, string>>;
}

/**
 * Dashboard layout — Server Component.
 *
 * `requireSession()` redirects unauthenticated visitors to /login.
 * This guard is the single enforcement point for the entire
 * `(dashboard)` route group — no per-page duplication needed.
 *
 * Title is hardcoded to "Dashboard" at this level; individual pages
 * override the browser <title> via their own `export const metadata`.
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps): Promise<JSX.Element> {
  await requireSession();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Dashboard" />
        <main className="flex-1 overflow-y-auto p-6" id="main-content" aria-label="Main content">
          {children}
        </main>
      </div>
    </div>
  );
}
