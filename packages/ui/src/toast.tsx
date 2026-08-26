"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { cn } from "./utils";

type ToastVariant = "success" | "error" | "warning" | "info";

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

export interface ToastProps {
  /** Message to display */
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Set to 0 to disable. Defaults to 4000. */
  duration?: number;
  /** Called when the toast finishes or is manually dismissed. */
  onDismiss: () => void;
}

/** Delay before dismissing once the pointer leaves a hovered toast. */
const HOVER_DISMISS_DELAY_MS = 3000;

export function Toast({
  message,
  variant = "info",
  duration = 4000,
  onDismiss,
}: ToastProps): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const wasHoveredRef = useRef(false);

  useEffect(() => {
    if (duration === 0 || hovered) return;
    const timer = setTimeout(onDismiss, wasHoveredRef.current ? HOVER_DISMISS_DELAY_MS : duration);
    return () => {
      clearTimeout(timer);
    };
  }, [duration, hovered, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => {
        if (duration === 0) return;
        wasHoveredRef.current = true;
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      style={{ animation: "tf-slide-in 0.2s ease-out" }}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-md",
        variantStyles[variant],
      )}
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        ✕
      </button>

      {/* Keyframe defined inline - no tailwindcss-animate plugin required */}
      <style>{`
        @keyframes tf-slide-in {
          from { opacity: 0; transform: translateY(0.75rem); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps): JSX.Element {
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant ?? "info"}
          duration={toast.duration ?? 4000}
          onDismiss={() => {
            onDismiss(toast.id);
          }}
        />
      ))}
    </div>
  );
}
