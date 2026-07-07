/**
 * Mock for `next/headers` - provides a controllable `headers()` function.
 *
 * Activate per test file:
 *   vi.mock("next/headers", () => import("@/tests/mocks/next-header.js"))
 *
 * Override per test:
 *   vi.mocked(headers).mockResolvedValueOnce(makeHeaders({ cookie: "..." }))
 */
import { vi } from "vitest";

export const headers = vi.fn<() => Promise<Headers>>(() => Promise.resolve(new Headers()));

interface MockCookies {
  get: (name: string) => string | undefined;
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
