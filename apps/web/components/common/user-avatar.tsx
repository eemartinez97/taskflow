import type { JSX } from "react";

import { cn } from "@taskflow/ui";

import { displayName, userInitials } from "@/lib/utils/user";

interface UserAvatarProps {
  user: { name?: string | null; email?: string | null };
  size?: "xs" | "sm" | "md";
  /** Optional background override (presence colors). Defaults to the brand tint. */
  color?: string;
  className?: string;
  /** Dims the avatar and appends "· ex" to its tooltip/accessible name. */
  isFormer?: boolean | undefined;
}

const SIZES = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
} as const;

/** Initials avatar - single source of truth for user chips across the app. */
export function UserAvatar({
  user,
  size = "sm",
  color,
  className,
  isFormer = false,
}: UserAvatarProps): JSX.Element {
  const name = displayName(user);
  const title = isFormer ? `${name} · ex` : name;

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        color ? "text-white" : "bg-brand-100 text-brand-700",
        SIZES[size],
        isFormer && "opacity-50",
        className,
      )}
      {...(color ? { style: { backgroundColor: color } } : {})}
    >
      {userInitials(user)}
    </span>
  );
}
