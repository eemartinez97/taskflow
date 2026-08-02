"use client";

import { useSyncExternalStore } from "react";
import { getOnlineUsers, getServerOnlineUsers, subscribe } from "@/lib/socket/presence-store";

/**
 * Reads org-wide online presence from the shared store fed by the single
 * global socket in `useGlobalRealtime`. Does NOT open a connection.
 */
export function useOnlineUsers(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getOnlineUsers, getServerOnlineUsers);
}
