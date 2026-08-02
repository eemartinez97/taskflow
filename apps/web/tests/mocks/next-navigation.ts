/**
 * Mock for `next/navigation` - used in unit tests for components
 * that call useRouter, usePathname, useSearchParams, or redirect().
 *
 * Activate per test file:
 *   vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation))
 *
 * Override per test:
 *   vi.mocked(usePathname).mockReturnValue("/dashboard")
 */

import { vi } from "vitest";
import type {
  useRouter as useRouterType,
  usePathname as usePathnameType,
  useSearchParams as useSearchParamsType,
  redirect as redirectType,
  notFound as notFoundType,
  ReadonlyURLSearchParams,
} from "next/navigation";

export const useRouter = vi.fn<typeof useRouterType>(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));

export const usePathname = vi.fn<typeof usePathnameType>(() => "/");

export const useSearchParams = vi.fn<typeof useSearchParamsType>(
  () => new URLSearchParams() as unknown as ReadonlyURLSearchParams,
);

export const redirect = vi.fn<typeof redirectType>();

export const notFound = vi.fn<typeof notFoundType>();
