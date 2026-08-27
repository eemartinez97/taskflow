import { createCookieStore } from "./cookie-store";

/**
 * Deliberately its own file with NO "use client" directive, separate from
 * the `useSidebarCollapse` hook that consumes it - that hook file imports
 * `useSyncExternalStore` and so must be "use client", and Next's bundler
 * treats importing anything from a "use client" file as pulling the whole
 * file into the client boundary. `SidebarServer` (a Server Component) needs
 * only the cookie name and parser below, not the hook, so it imports
 * straight from here instead - keeping this module import-safe from server
 * code is exactly why it can't just live inside use-sidebar-collapse.ts.
 */
export const SIDEBAR_COLLAPSE_COOKIE = "taskflow.sidebar.collapsed";

export function parseSidebarCollapsed(raw: string | null | undefined): boolean {
  return raw === "true";
}

export const sidebarCollapseStore = createCookieStore<boolean>({
  cookieName: SIDEBAR_COLLAPSE_COOKIE,
  parse: parseSidebarCollapsed,
  serialize: (value) => String(value),
  serverValue: false,
});
