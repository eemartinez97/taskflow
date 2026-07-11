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
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full appearance-none rounded-md border",
          "bg-white pl-4 pr-10 py-2.5",
          "text-sm text-gray-900",
          "transition-colors duration-150",
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
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400"
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}
