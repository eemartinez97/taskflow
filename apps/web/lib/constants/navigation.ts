import { CheckSquare, FolderKanban, Mail, Settings, Users } from "lucide-react";
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
 * "Team" (not "Organizations"): the org switcher in the sidebar already
 * declares which org is active, so a separate org-picking screen was a
 * redundant hop. /team shows the roster + invitations for whichever org is
 * currently active; renaming/deleting an org lives in Settings instead.
 * /organizations/[orgId] still exists as a deep link (see proxy.ts) that
 * sets the active-org cookie and redirects here - old notifications with
 * entityType "org" still point at it.
 *
 * Must stay a static module-scope array - it's both the Sidebar's link
 * source and (with SECONDARY_ROUTE_TITLES below) the Header's route->title
 * map, so it can't depend on the active-org cookie.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "My Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Team", href: "/team", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

/**
 * Titles for routes reachable WITHOUT a sidebar link of their own:
 * /invitations, both the index and the /[token] emailed-link page. No entry
 * for /organizations/[orgId] - proxy.ts redirects it before any page ever
 * renders, so the Header never observes that pathname. The Header checks
 * this list after NAV_ITEMS so a page's title doesn't silently fall back to
 * "Dashboard". `icon` is unused by the Header's title lookup but kept so
 * both arrays share one shape.
 */
export const SECONDARY_ROUTE_TITLES: NavItem[] = [
  { label: "Invitation", href: "/invitations", icon: Mail },
];
