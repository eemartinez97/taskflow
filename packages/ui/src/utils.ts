import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with Tailwind conflict resolution.
 * Uses tailwind-merge to handle class overrides correctly
 * (e.g., "text-lg" overridden by "text-sm" passed via className prop).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
