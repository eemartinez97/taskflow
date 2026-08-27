"use client";

import { useCallback, useSyncExternalStore } from "react";

import { sidebarCollapseStore as store } from "@/lib/utils/sidebar-collapse-cookie";

export interface SidebarCollapseState {
  collapsed: boolean;
  toggle: () => void;
}

/**
 * Persists the sidebar's collapsed/expanded state across sessions via a
 * cookie (not localStorage) so the server can read it too. `initialCollapsed`
 * should come from a server-side `cookies()` read (see `SidebarServer`) so it
 * matches what the server actually rendered - useSyncExternalStore only
 * calls this closure during real SSR/hydration, never afterward, so there is
 * no expand/collapse flash on load.
 */
export function useSidebarCollapse(initialCollapsed = false): SidebarCollapseState {
  const collapsed = useSyncExternalStore(
    store.subscribe,
    store.read,
    /* v8 ignore next -- only invoked by useSyncExternalStore during real SSR/hydration; jsdom-based tests always exercise the client store.read() path instead */
    () => initialCollapsed,
  );

  const toggle = useCallback(() => {
    store.write(!store.read());
  }, []);

  return { collapsed, toggle };
}
