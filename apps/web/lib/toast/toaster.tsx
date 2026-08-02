"use client";

import { useSyncExternalStore, type JSX } from "react";

import { ToastContainer } from "@taskflow/ui";

import { dismissToast, getServerToasts, getToasts, subscribe } from "./store";

/** Mount ONCE in app/providers.tsx - renders the global toast queue. */
export function Toaster(): JSX.Element {
  const toasts = useSyncExternalStore(subscribe, getToasts, getServerToasts);

  return <ToastContainer toasts={[...toasts]} onDismiss={dismissToast} />;
}
