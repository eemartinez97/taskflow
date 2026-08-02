import type { ToastItem } from "@taskflow/ui";

/**
 * Imperative toast store (module singleton, browser-only in practice).
 *
 * WHY not React context: the global MutationCache handler in
 * query-client.ts lives outside the React tree and must be able to
 * push toasts. The <Toaster /> component subscribes via
 * useSyncExternalStore and renders the queue.
 */

type Listener = () => void;

let toasts: readonly ToastItem[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

function show(message: string, variant: NonNullable<ToastItem["variant"]>): void {
  const item: ToastItem = { id: crypto.randomUUID(), message, variant };
  toasts = [...toasts, item];
  emit();
}

/** Public API - import `toast` anywhere (components, query-client, hooks). */
export const toast = {
  success: (message: string): void => {
    show(message, "success");
  },
  error: (message: string): void => {
    show(message, "error");
  },
  warning: (message: string): void => {
    show(message, "warning");
  },
  info: (message: string): void => {
    show(message, "info");
  },
};

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): readonly ToastItem[] {
  return toasts;
}

/** Stable empty snapshot for SSR - useSyncExternalStore requires it. */
const EMPTY: readonly ToastItem[] = [];
export function getServerToasts(): readonly ToastItem[] {
  return EMPTY;
}
