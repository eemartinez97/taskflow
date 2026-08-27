"use client";

import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { type JSX } from "react";
import Link from "next/link";

import { NAV_ITEMS } from "@/lib/constants/navigation";
import { useSidebarCollapse } from "@/lib/hooks/use-sidebar-collapse";
import { cn } from "@taskflow/ui";
import { OrgSwitcher } from "./org-switcher";

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarCollapse();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-200",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <Link
          href="/projects"
          className="flex items-center gap-2 text-base font-semibold text-brand-700"
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          <span className={cn(collapsed && "sr-only")}>TaskFlow</span>
        </Link>
      </div>

      {/* Hidden while collapsed rather than shrunk - OrgSwitcher's menu/name/role
      layout has no icon-only mode of its own; expand the rail to reach it. */}
      {!collapsed && (
        <div className="border-b border-gray-200">
          <OrgSwitcher />
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main navigation">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(collapsed && "sr-only")}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronLeft className="h-4 w-4 shrink-0" />
          )}
          <span className={cn(collapsed && "sr-only")}>Collapse</span>
        </button>
      </div>
    </aside>
  );
}
