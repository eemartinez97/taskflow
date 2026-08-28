import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  type LucideIcon,
} from "lucide-react";

import type { Task } from "@taskflow/database";
import type { TaskStatus } from "@taskflow/shared";
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

/** Text color per task status - tints the STATUS_ICONS glyph. */
export const STATUS_TEXT_COLORS = {
  TODO: "text-gray-500",
  IN_PROGRESS: "text-blue-600",
  IN_REVIEW: "text-purple-600",
  DONE: "text-green-600",
  CANCELLED: "text-red-500",
} as const satisfies Record<TaskStatus, string>;

/**
 * Icon per task status - shape carries the meaning (not just color), the
 * same convention Linear/Jira/Asana use for workflow-state glyphs, so it
 * reads correctly even before you've learned the color mapping.
 */
export const STATUS_ICONS = {
  TODO: Circle,
  IN_PROGRESS: CircleDot,
  IN_REVIEW: CircleDashed,
  DONE: CircleCheck,
  CANCELLED: CircleX,
} as const satisfies Record<TaskStatus, LucideIcon>;
