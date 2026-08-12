import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import type * as TanstackReactQuery from "@tanstack/react-query";
import "./env";
import "./silence-console";

// once. Individual tests still override return values via vi.mocked().
vi.mock("@taskflow/ui", async () => await import("@/tests/mocks/taskflow-ui"));
vi.mock("@/lib/trpc/client", async () => await import("@/tests/mocks/trpc-api"));
vi.mock("@/lib/toast/store", async () => await import("@/tests/mocks/toast-store"));
vi.mock("server-only", async () => await import("@/tests/mocks/server-only"));
vi.mock("next/navigation", async () => await import("@/tests/mocks/next-navigation"));
vi.mock("next-auth/react", async () => await import("@/tests/mocks/next-auth"));
vi.mock("next/link", async () => await import("@/tests/mocks/next-link"));
// Partial mock: preserves every real export - only useIsFetching/useIsMutating
// (used by useGlobalLoading) are stubbed. See tests/mocks/tanstack-query.ts.
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof TanstackReactQuery>()),
  ...(await import("@/tests/mocks/tanstack-query")),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
