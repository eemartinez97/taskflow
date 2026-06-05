import type { JSX } from "react";
import { cn } from "./utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Renders the select in error state */
  hasError?: boolean;

  ref?: React.Ref<HTMLSelectElement>;
}

/**
 * Native <select> wrapper.
 * For rich dropdowns the consuming app can use a headless library.
 * React 19: ref accepted as plain prop.
 */
export function Select({ hasError, className, children, ref, ...props }: SelectProps): JSX.Element {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full appearance-none rounded-md border bg-white px-3 py-1 text-sm",
        "text-gray-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        hasError
          ? "border-red-500 focus-visible:ring-red-500"
          : "border-gray-300 focus-visible:ring-brand-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
