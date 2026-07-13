import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JSX } from "react";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database"));
vi.mock("@taskflow/api/trpc", () => import("@/tests/mocks/taskflow-api"));
vi.mock("next/headers", () => import("@/tests/mocks/next-headers"));
vi.mock("pino", () => import("@/tests/mocks/pino"));
vi.mock("server-only");
/**
 * Replace React.cache with identity so each call re-executes.
 * This prevents stale state leaking between tests since the
 * per-request cache is not reset automatically in jsdom.
 */
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    HydrationBoundary: ({ children }: { children?: React.ReactNode }): JSX.Element =>
      (children ?? null) as unknown as JSX.Element,
    dehydrate: vi.fn(() => ({})),
  };
});

import { render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";

import { getQueryClient, getServerTRPC, TRPCHydrationBoundary } from "@/lib/trpc/server";
import { makeHeaders, makeSessionHeaders, mockServerSessionUser } from "@/tests/helpers";
import { headers } from "@/tests/mocks/next-headers";
import { getSession } from "@/lib/auth/session";

describe("getQueryClient", () => {
  it("returns a QueryClient instance", () => {
    expect(getQueryClient()).toBeInstanceOf(QueryClient);
  });

  it("configures a positive staleTime on queries", () => {
    expect(getQueryClient().getDefaultOptions().queries?.staleTime).toBeGreaterThan(0);
  });

  it("configures dehydrate.serializeData (superjson integration)", () => {
    expect(getQueryClient().getDefaultOptions().dehydrate?.serializeData).toBeDefined();
  });

  it("configures hydrate.deserializeData (superjson integration)", () => {
    expect(getQueryClient().getDefaultOptions().hydrate?.deserializeData).toBeDefined();
  });
});

describe("getServerTRPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(makeHeaders());
  });

  it("resolves to a defined caller object", async () => {
    await expect(getServerTRPC()).resolves.toBeDefined();
  });

  it("calls next/headers() to read the current request headers", async () => {
    await getServerTRPC();
    expect(headers).toHaveBeenCalledOnce();
  });

  it("calls getSession during context creation", async () => {
    await getServerTRPC();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("resolves when session is null (unauthenticated public caller)", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    await expect(getServerTRPC()).resolves.toBeDefined();
  });

  it("resolves when session is a valid user", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockServerSessionUser);
    vi.mocked(headers).mockResolvedValue(makeSessionHeaders("tok"));
    await expect(getServerTRPC()).resolves.toBeDefined();
  });
});

describe("TRPCHydrationBoundary", () => {
  it("renders its children", () => {
    render(
      <TRPCHydrationBoundary>
        <p data-testid="child">hydrated</p>
      </TRPCHydrationBoundary>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <TRPCHydrationBoundary>
        <span data-testid="a">A</span>
        <span data-testid="b">B</span>
      </TRPCHydrationBoundary>,
    );
    expect(screen.getByTestId("a")).toBeInTheDocument();
    expect(screen.getByTestId("b")).toBeInTheDocument();
  });

  it("does not throw when children is plain text", () => {
    expect(() => render(<TRPCHydrationBoundary>plain text</TRPCHydrationBoundary>)).not.toThrow();
  });
});
