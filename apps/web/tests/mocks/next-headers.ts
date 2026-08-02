/**
 * Mock for `next/headers` - provides controllable `headers()` and `cookies()`.
 *
 * Activate per test file:
 *   vi.mock("next/headers", () => import("@/tests/mocks/next-headers"));
 *
 * Override per test:
 *   vi.mocked(headers).mockResolvedValueOnce(makeHeaders({ cookie: "..." }));
 *   vi.mocked(cookies).mockResolvedValueOnce(makeCookies({ [ACTIVE_ORG_COOKIE]: "org-1" }));
 */
import { vi } from "vitest";

export const headers = vi.fn<() => Promise<Headers>>(() => Promise.resolve(new Headers()));

interface MockCookies {
  get: (name: string) => { name: string; value: string } | undefined;
  getAll: () => { name: string; value: string }[];
  has: (name: string) => boolean;
}

export const cookies = vi.fn<() => Promise<MockCookies>>(async () =>
  Promise.resolve({
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue([]),
    has: vi.fn().mockReturnValue(false),
  }),
);

/** Convenience builder for tests that need a specific cookie present. */
export function makeCookies(values: Record<string, string> = {}): MockCookies {
  return {
    get: (name: string) => {
      const value = values[name];
      if (value !== undefined) return { name, value };
      return undefined;
    },
    getAll: () => Object.entries(values).map(([name, value]) => ({ name, value })),
    has: (name: string) => name in values,
  };
}
