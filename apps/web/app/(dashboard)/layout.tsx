import { Suspense, type JSX } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard layout for Next.js 16 with `cacheComponents: true`.
 *
 * WHY: Next.js 16 treats Server Components as cacheable by default. Any component
 * that reads dynamic data (like cookies via `getServerSession` in the pages or
 * tRPC context) will throw an "Uncached data accessed outside <Suspense>" error
 * if it is not explicitly wrapped in a Suspense boundary.
 *
 * HOW: Wrapping `children`, `<Sidebar />`, and `<Header />` in `<Suspense>`
 * allows the static layout to render immediately while dynamic data resolves,
 * satisfying Next.js 16 strict caching rules without using `force-dynamic`.
 *
 * The Header derives its title from the current route (previously it was
 * hardcoded to "Dashboard" on every page).
 *
 * Auth redirect is handled by `proxy.ts` - no requireSession() needed here.
 */

export default function DashboardLayout({ children }: DashboardLayoutProps): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Wrap Sidebar and Header in case they use getSession internally */}
      <Suspense fallback={<div className="w-64 bg-gray-100 animate-pulse" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-16 bg-white border-b animate-pulse" />}>
          <Header />
        </Suspense>

        <main className="flex-1 overflow-y-auto p-6" id="main-content" aria-label="Main content">
          {/* The error came from ProjectsPage (children), which calls getServerTRPC -> getSession */}
          <Suspense fallback={<div className="text-gray-500 p-4">Loading...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
