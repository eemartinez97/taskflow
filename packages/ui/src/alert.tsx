import type { JSX } from "react";
import { cn } from "./utils";

type AlertVariant = "error" | "success" | "warning";

const VARIANT_STYLES: Record<AlertVariant, string> = {
  error: "bg-red-50 text-red-700",
  success: "bg-green-50 text-green-700",
  warning: "bg-yellow-50 text-yellow-800",
};

export interface AlertProps {
  /**
   * The message to display. When `null` or `undefined` the component
   * renders nothing - safe to pass `mutation.error?.message` directly.
   */
  message?: string | null;
  variant?: AlertVariant;
  className?: string;
}

/**
 * Inline alert for form-level error/success feedback.
 * Returns `null` when message is empty so callers never need to guard it.
 *
 * Different from Toast (which auto-dismisses and floats).
 * Alert is static and stays visible until the condition clears.
 */
export function Alert({ message, variant = "error", className }: AlertProps): JSX.Element | null {
  if (!message) return null;

  return (
    <p
      role="alert"
      className={cn("rounded-md px-3 py-2 text-sm", VARIANT_STYLES[variant], className)}
    >
      {message}
    </p>
  );
}
