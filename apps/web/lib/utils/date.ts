/**
 * Compact relative time ("3m ago"). Client-only by design: it reads
 * Date.now(), so rendering it during SSR would cause a hydration mismatch.
 */
export function formatRelativeTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${String(minutes)}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)}d ago`;

  return date.toLocaleDateString("en-US");
}
