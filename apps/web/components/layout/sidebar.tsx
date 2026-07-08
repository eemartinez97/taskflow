"use client";

import {
  FolderKanban as FolderKanbanIcon,
  CheckSquare as CheckSquareIcon,
  Settings as SettingsIcon,
  Users as UsersIcon,
  LayoutDashboard,
} from "lucide-react";

import { usePathname } from "next/navigation";
import { cn } from "@taskflow/ui";
import { type JSX } from "react";
import Link from "next/link";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanbanIcon },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquareIcon },
  { label: "Team", href: "/dashboard/team", icon: UsersIcon },
  { label: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <Link
          href="/dashboard/projects"
          className="flex items-center gap-2 text-base font-semibold text-brand-700"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>TaskFlow</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main navigation">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
