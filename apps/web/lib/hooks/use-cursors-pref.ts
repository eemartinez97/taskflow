"use client";

import { useSyncExternalStore } from "react";

import {
  getServerCursorsHidden,
  readCursorsHidden,
  subscribeCursorsPref,
} from "@/lib/utils/cursor-pref";

/** Reactive read of the "hide peer cursors" preference from its cookie store. */
export function useCursorsHidden(): boolean {
  return useSyncExternalStore(subscribeCursorsPref, readCursorsHidden, getServerCursorsHidden);
}
