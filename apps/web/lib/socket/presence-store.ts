/**
 * Imperative online-presence store (module singleton, browser-only in practice).
 *
 * WHY an external store (mirrors lib/toast/store.ts): the single global socket
 * lives inside `useGlobalRealtime` (mounted once in the Header). Any component
 * that needs "who is online" reads it via useSyncExternalStore WITHOUT opening
 * its own socket connection.
 *
 * The snapshot reference is cached and only swapped when the set actually
 * changes, so useSyncExternalStore never loops.
 */
type Listener = () => void;

let onlineUserIds: ReadonlySet<string> = new Set();
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Replaces the whole roster (PRESENCE_ONLINE_SYNC). */
export function setOnlineUsers(userIds: readonly string[]): void {
  onlineUserIds = new Set(userIds);
  emit();
}

/** Adds a user (PRESENCE_ONLINE). No-op + no emit when already present. */
export function addOnlineUser(userId: string): void {
  if (onlineUserIds.has(userId)) return;
  onlineUserIds = new Set(onlineUserIds).add(userId);
  emit();
}

/** Removes a user (PRESENCE_OFFLINE). No-op + no emit when absent. */
export function removeOnlineUser(userId: string): void {
  if (!onlineUserIds.has(userId)) return;
  const next = new Set(onlineUserIds);
  next.delete(userId);
  onlineUserIds = next;
  emit();
}

/** Clears the roster when the global socket tears down. */
export function resetOnlineUsers(): void {
  if (onlineUserIds.size === 0) return;
  onlineUserIds = new Set();
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOnlineUsers(): ReadonlySet<string> {
  return onlineUserIds;
}

/** Stable empty snapshot for SSR - useSyncExternalStore requires it. */
const EMPTY: ReadonlySet<string> = new Set();
export function getServerOnlineUsers(): ReadonlySet<string> {
  return EMPTY;
}
