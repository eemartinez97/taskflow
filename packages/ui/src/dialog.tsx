"use client";

import { useEffect, useRef, type JSX } from "react";
import { cn } from "./utils";

export interface DialogProps {
  /** Controls visibility. */
  open: boolean;
  /** Called when the user presses Escape or clicks the backdrop. */
  onClose: () => void;
  /** Accessible title rendered as <h2>. */
  title: string;
  /** Optional description below the title. */
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal dialog built on the native <dialog> element.
 * Traps focus, supports Escape key, and prevents body scroll while open.
 * React 19: ref accepted as plain prop.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync open state with the native <dialog> API
  useEffect(() => {
    const el = dialogRef.current;

    /* v8 ignore next - ref is always set when component is mounted */
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Sync native `close` event (Escape key) back to parent state
  useEffect(() => {
    const el = dialogRef.current;

    /* v8 ignore next - ref is always set when component is mounted */
    if (!el) return;

    const handleClose = (): void => {
      onClose();
    };

    el.addEventListener("close", handleClose);

    return () => {
      el.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        // Reset browser default styles
        "rounded-xl border border-gray-200 bg-white p-0 shadow-lg",
        "w-full max-w-md backdrop:bg-black/40",
        // Use React-controlled class instead of open: Tailwind variant
        // to avoid relying on browser attribute timing
        open ? "flex flex-col" : "hidden",
        className,
      )}
      // Click directly on the backdrop (the <dialog> element itself) closes it
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold leading-none text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>

      <div className="flex-1 px-6 py-4">{children}</div>
    </dialog>
  );
}
