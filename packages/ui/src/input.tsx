import type { JSX } from "react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders the input in error state with red ring. */
  hasError?: boolean;

  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Controlled/uncontrolled text input
 * React 19: ref accepted as plain prop.
 */
export function Input({ hasError = false, className, ref, ...props }: InputProps): JSX.Element {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border bg-white px-3 py-1 text-sm",
        "text-gray-900 placeholder:text-gray-400",
        "transition-colors duration-150",
        // ring default is 1px in Tailwind 4 - use ring-2 for focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        hasError
          ? "border-red-500 focus-visible:ring-red-500"
          : "border-gray-300 focus-visible:ring-brand-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
