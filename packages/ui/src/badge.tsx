import type { JSX } from "react";
import { cn } from "./utils";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-brand-100 text-brand-700 border-brand-200",
  success: "bg-green-100 text-green-700 border-green-200",
  warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
  destructive: "bg-red-100 text-red-700 border-red-200",
  outline: "bg-transparent text-gray-700 border-gray-300",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
