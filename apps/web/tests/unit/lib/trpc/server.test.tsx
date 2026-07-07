import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JSX } from "react";

vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database.js"));
vi.mock("@taskflow/api/trpc", () => import("@/tests/mocks/taskflow-api.js"));
vi.mock("next/headers", () => import("@/tests/mocks/next-headers.js"));
vi.mock("pino", () => import("@/tests/mocks/pino.js"));
vi.mock("server-only");
vi.mock("@/lib/auth/server-session", () => ({
  getServerSessionFromHeaders: vi.fn().mockResolvedValue(null),
}));
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    HydrationBoundary: ({ children }: { children?: React.ReactNode }): JSX.Element =>
      (children ?? null) as unknown as JSX.Element,
    dehydrate: vi.fn(() => ({})),
  };
});
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, cache: (fn: unknown) => fn };
});

import { render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";

import { makeHeaders, makeSessionHeaders, mockServerSessionUser } from "@/tests/helpers.js";
import { getServerSessionFromHeaders } from "@/lib/auth/server-session";
import { headers } from "@/tests/mocks/next-headers.js";
import { getQueryClient, getServerTRPC, TRPCHydrationBoundary } from "@/lib/trpc/server";

describe("getQueryClient", () => {
  it("returns a QueryClient and the same instance on repeated calls (React cache mock = identify)", () => {
    const q = getQueryClient();
    expect(q).toBeInstanceOf(QueryClient);
    expect(getQueryClient()).toBe(q);
  });
});

describe("getServerTRPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(makeHeaders());
  });

  it("calls getServerSessionFromHeaders during context creation", async () => {
    vi.mocked(headers).mockResolvedValue(makeSessionHeaders("tok"));
    vi.mocked(getServerSessionFromHeaders).mockResolvedValue(null);
    await getServerTRPC();
    expect(getServerSessionFromHeaders).toHaveBeenCalledOnce();
  });

  it("passes a Headers instance to getServerSessionFromHeaders", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValue(mockServerSessionUser);
    await getServerTRPC();
    expect(getServerSessionFromHeaders).toHaveBeenCalledWith(expect.any(Headers));
  });

  it("resolves without throwing when session is null or valid", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValue(null);
    await expect(getServerTRPC()).resolves.toBeDefined();

    vi.mocked(getServerSessionFromHeaders).mockResolvedValue(mockServerSessionUser);
    await expect(getServerTRPC()).resolves.toBeDefined();
  });
});

describe("TRPCHydrationBoundary", () => {
  it("renders children", () => {
    render(
      <TRPCHydrationBoundary>
        <p data-testid="child">hydrated</p>
      </TRPCHydrationBoundary>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("does not throw when children is a string", () => {
    expect(() => render(<TRPCHydrationBoundary>plain text</TRPCHydrationBoundary>)).not.toThrow();
  });
});
