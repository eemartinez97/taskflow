import type { JSX } from "react";
import { cn } from "./utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Removes padding, Useful when the card contains a full-bleed image or table */
  noPadding?: boolean;
}

export function Card({ noPadding = false, className, children, ...props }: CardProps): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white shadow-xs",
        !noPadding && "p-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controls bottom margin. Use "none" for compact cards in grids. */
  spacing?: "default" | "compact" | "none";
  /** Renders a subtle divider line below the header */
  divider?: boolean;
}

export function CardHeader({
  className,
  children,
  spacing = "default",
  divider = false,
  ...props
}: CardHeaderProps): JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col",
        spacing === "default" && (divider ? "pb-5 mb-5 border-b border-gray-100" : "mb-6"),
        spacing === "compact" && (divider ? "pb-3 mb-3 border-b border-gray-100" : "mb-3"),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  return (
    <h3
      className={cn("text-lg font-semibold leading-tight tracking-tight text-gray-900", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn("flex flex-col", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn("flex items-center pt-4", className)} {...props}>
      {children}
    </div>
  );
}
