/**
 * Lightweight class name merger.
 * Concatenates truthy strings — no external dependency needed for primitives.
 * For complex merging (Tailwind class conflicts) the consuming app can wrap
 * this with tailwind-merge; packages/ui stays dependency-light.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
