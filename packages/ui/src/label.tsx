import type { JSX } from "react";
import { cn } from "./utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Appends a red asterisk to indicate a required field */
  required?: boolean;
}

export function Label({
  required = false,
  className,
  children,
  ...props
}: LabelProps): JSX.Element {
  return (
    <label
      className={cn(
        "block text-sm font-medium leading-none text-gray-700",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-red-500">
          *
        </span>
      )}
    </label>
  );
}
