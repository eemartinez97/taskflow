import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import type * as TanstackQuery from "@tanstack/react-query";
import type * as TRPCReactQuery from "@trpc/react-query";
import { render, screen } from "@testing-library/react";
import type { JSX } from "react";

vi.mock("@taskflow/api/trpc", () => import("@/tests/mocks/taskflow-api"));
vi.mock("pino", () => import("@/tests/mocks/pino"));
vi.mock("@/lib/auth/server-session", () => ({
  getServerSessionFromHeaders: vi.fn().mockResolvedValue(null),
}));
vi.mock("@trpc/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof TRPCReactQuery>();
  return {
    ...actual,
    createTRPCReact: vi.fn(() => ({
      Provider: ({ children }: { children: React.ReactNode }): JSX.Element =>
        children as unknown as JSX.Element,
      createClient: vi.fn(() => ({})),
    })),
  };
});
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof TanstackQuery>();
  return {
    ...actual,
    QueryClientProvider: ({ children }: { children: React.ReactNode }): JSX.Element =>
      children as JSX.Element,
  };
});

import { TRPCProvider, getBaseUrl, api, getTRPCHeaders } from "@/lib/trpc/client";

afterEach(() => vi.unstubAllGlobals());

describe("getBaseUrl", () => {
  it("returns '' in the browser (relative URL, same origin)", () => {
    expect(getBaseUrl()).toBe("");
  });

  it("returns an absolute http URL on the server", () => {
    vi.stubGlobal("window", undefined);
    expect(getBaseUrl().startsWith("http")).toBe(true);
  });
});

describe("getTRPCHeaders", () => {
  it("returns { cookie: document.cookie } in the browser", () => {
    const result = getTRPCHeaders();
    expect(result).toHaveProperty("cookie");
    expect(typeof result.cookie).toEqual("string");
  });

  it("returns {} on the server (no document.cookie)", () => {
    vi.stubGlobal("window", undefined);
    expect(getTRPCHeaders()).toEqual({});
  });

  it("reflects current document.cookie value", () => {
    const testCookie = "next-auth.session-token=test-value";
    Object.defineProperty(document, "cookie", {
      get: () => testCookie,
      configurable: true,
    });
    expect(getTRPCHeaders().cookie).toBe(testCookie);
  });
});

describe("TRPCProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders children without errors", () => {
    render(
      <TRPCProvider>
        <p data-testid="child">hello tRPC</p>
      </TRPCProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <TRPCProvider>
        <span data-testid="a">a</span>
        <span data-testid="b">b</span>
      </TRPCProvider>,
    );
    expect(screen.getByTestId("a")).toBeInTheDocument();
    expect(screen.getByTestId("b")).toBeInTheDocument();
  });
});

describe("api (createTRPCReact instance)", () => {
  it("has a Provider and createClient", () => {
    expect(api.Provider).toBeDefined();
    expect(typeof api.createClient).toBe("function");
  });
});
