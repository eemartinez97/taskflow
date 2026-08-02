import { Building2, CheckSquare, FolderKanban, Settings, Users } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

/**
 * Main navigation - single source of truth consumed by BOTH the Sidebar
 * (links) and the Header (route -> title). The Header used to render a
 * hardcoded "Dashboard" on every page; deriving the title from the same
 * list keeps the two in sync and makes adding a section a one-file edit.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "My Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Team", href: "/team", icon: Users },
  { label: "Organizations", href: "/organizations", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
];
