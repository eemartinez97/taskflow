/**
 * Runtime environment detection utilities.
 *
 * Single source of truth for browser vs. server checks.
 * Eliminates the `typeof window !== "undefined"` pattern scattered
 * across the codebase - import these instead.
 */

/** Returns `true` when running in a browser context. */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Returns `true` when running in a server context (Node.js / Edge). */
export function isServer(): boolean {
  return !isBrowser();
}
