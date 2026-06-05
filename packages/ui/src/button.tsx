import type { JSX } from "react";
import { cn } from "./utils";

// Variant and size maps — defined outside component to avoid re-creation on each render
const variantClasses = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 disabled:bg-brand-300",
  secondary:
    "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400 disabled:opacity-50",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300",
  ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400 disabled:opacity-50",
  link: "text-brand-600 underline-offset-4 hover:underline focus-visible:ring-brand-500 disabled:opacity-50",
} as const;

const sizeClasses = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-base gap-2",
  icon: "h-9 w-9",
} as const;

type Variant = keyof typeof variantClasses;
type Size = keyof typeof sizeClasses;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. Defaults to "primary". */
  variant?: Variant;
  /** Size preset. Defaults to "md". */
  size?: Size;
  /** Shows a loading spinner and disables the button */
  loading?: boolean;
  /** Renders as full-width block. */
  fullWidth?: boolean;

  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Primary interactive element.
 * React 19: ref is accepted as a plain prop - no forwardRef wrapper needed.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ref,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      aria-busy={loading}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-colors duration-150",
        // Focus ring - ring default is 1px in Tailwind 4; use ring-2 explicity
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none",
        // Variant + size
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          aria-hidden="true"
          className="animate-spin h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
