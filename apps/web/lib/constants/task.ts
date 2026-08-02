import type { Task } from "@taskflow/database";
import type { BadgeProps } from "@taskflow/ui";

/**
 * Badge variant per task priority.
 */
export const PRIORITY_COLORS = {
  NONE: "outline",
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "destructive",
  URGENT: "destructive",
} as const satisfies Record<Task["priority"], NonNullable<BadgeProps["variant"]>>;
