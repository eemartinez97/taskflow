"use client";

import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { type JSX, type ReactNode } from "react";
import Link from "next/link";

import { NAV_ITEMS } from "@/lib/constants/navigation";
import { useSidebarCollapse } from "@/lib/hooks/use-sidebar-collapse";
import { cn } from "@taskflow/ui";
import { OrgSwitcher } from "./org-switcher";

interface SidebarProps {
  /** Real cookie-derived value from the server - avoids an expand/collapse flash on load. */
  initialCollapsed?: boolean;
}

/** A label that becomes visually hidden (but still screen-reader-visible) while collapsed - used for the brand, every nav item, and the toggle button below. */
function CollapsibleLabel({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}): JSX.Element {
  return <span className={cn(collapsed && "sr-only")}>{children}</span>;
}

export function Sidebar({ initialCollapsed = false }: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarCollapse(initialCollapsed);

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
          title={collapsed ? "TaskFlow" : undefined}
          className="flex items-center gap-2 text-base font-semibold text-brand-700"
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          <CollapsibleLabel collapsed={collapsed}>TaskFlow</CollapsibleLabel>
        </Link>
      </div>

      {/* OrgSwitcher renders a compact icon-only mode while collapsed rather
      than disappearing entirely - it's the only place the pending-invitations
      count is shown, so hiding it hid that count too. `key` remounts it on
      every collapse/expand toggle (see OrgSwitcherProps.collapsed) so its own
      menu/dialog state resets instead of surviving invisibly across modes. */}
      <div className="border-b border-gray-200">
        <OrgSwitcher key={collapsed ? "collapsed" : "expanded"} collapsed={collapsed} />
      </div>

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
              <CollapsibleLabel collapsed={collapsed}>{label}</CollapsibleLabel>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-2">
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : undefined}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronLeft className="h-4 w-4 shrink-0" />
          )}
          <CollapsibleLabel collapsed={collapsed}>
            {collapsed ? "Expand" : "Collapse"}
          </CollapsibleLabel>
        </button>
      </div>
    </aside>
  );
}
