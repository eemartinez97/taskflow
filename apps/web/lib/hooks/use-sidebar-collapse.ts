"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "taskflow.sidebar.collapsed";

const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

/** Exported for direct unit testing - useSyncExternalStore only calls this during actual SSR, never in jsdom. */
export function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writeCollapsed(value: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, String(value));
  for (const listener of listeners) listener();
}

export interface SidebarCollapseState {
  collapsed: boolean;
  toggle: () => void;
}

/**
 * Persists the sidebar's collapsed/expanded state across sessions.
 * useSyncExternalStore (same pattern as active-org.ts) rather than
 * useState+useEffect - getServerSnapshot matches SSR's expanded output, and
 * the client snapshot syncs on mount without a setState-in-effect render
 * cascade.
 */
export function useSidebarCollapse(): SidebarCollapseState {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, getServerSnapshot);

  const toggle = useCallback(() => {
    writeCollapsed(!readCollapsed());
  }, []);

  return { collapsed, toggle };
}
