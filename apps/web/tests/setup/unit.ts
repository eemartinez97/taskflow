import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import type * as TanstackReactQuery from "@tanstack/react-query";
import "./env";
import "./silence-console";

// Global mocks that are always identical across every unit test.
// Individual tests may still override return values via vi.mocked().
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("next/link", () => import("@/tests/mocks/next-link"));
vi.mock("@/lib/toast/store", async () => await import("@/tests/mocks/toast-store"));
vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation"));
vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
// Partial mock: query-client.ts/client.tsx construct a REAL QueryClient, so
// this must preserve every other export - only useIsFetching/useIsMutating
// (used by useGlobalLoading) are stubbed. See tests/mocks/tanstack-query.ts.
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof TanstackReactQuery>()),
  ...(await import("@/tests/mocks/tanstack-query")),
}));

// Ensures no DOM leaks between tests across the whole jsdom suite.
afterEach(() => {
  cleanup();
});
