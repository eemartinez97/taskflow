/**
 * Imperative nav-progress store (module singleton) - same pattern as
 * lib/toast/store.ts. Powers the top progress bar + "wait" cursor shown
 * during route transitions, so a slow deploy doesn't make a click look
 * like it did nothing.
 */

type Listener = () => void;

let active = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Call at the start of a navigation - click handler or before router.push(). */
export function startNavProgress(): void {
  if (active) return;
  active = true;
  emit();
}

/** Call once the destination route has rendered. */
export function endNavProgress(): void {
  if (!active) return;
  active = false;
  emit();
}

export function subscribeNavProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNavProgress(): boolean {
  return active;
}

/** Stable SSR snapshot - useSyncExternalStore requires it. */
export function getServerNavProgress(): boolean {
  return false;
}
