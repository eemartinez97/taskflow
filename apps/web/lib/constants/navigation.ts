import { Building2, CheckSquare, FolderKanban, Mail, Settings } from "lucide-react";
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
 *
 * No "Team" entry: member management now lives at /organizations/[orgId]
 * (an org-scoped detail page, not a standalone nav destination) - reached
 * via the Organizations list, not the sidebar.
 *
 * Must stay a static module-scope array - it's both the Sidebar's link
 * source and (with SECONDARY_ROUTE_TITLES below) the Header's route->title
 * map, so it can't depend on the active-org cookie.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "My Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Organizations", href: "/organizations", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

/**
 * Titles for routes reachable WITHOUT a sidebar link of their own:
 * /invitations/[token] (an emailed link, never a nav destination) and the
 * legacy /team redirect target. /organizations/[orgId] needs no entry here -
 * `pathname.startsWith("/organizations")` already matches NAV_ITEMS'
 * "Organizations" row. The Header checks this list after NAV_ITEMS so a
 * page's title doesn't silently fall back to "Dashboard". `icon` is unused
 * by the Header's title lookup but kept so both arrays share one shape.
 */
export const SECONDARY_ROUTE_TITLES: NavItem[] = [
  { label: "Invitation", href: "/invitations", icon: Mail },
  { label: "Team", href: "/team", icon: Building2 },
];
