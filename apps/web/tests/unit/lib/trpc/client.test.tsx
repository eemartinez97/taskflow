import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as TRPCReactQuery from "@trpc/react-query";
import type { httpBatchLink } from "@trpc/react-query";

vi.unmock("@/lib/trpc/client");

type BatchLinkConfig = Parameters<typeof httpBatchLink>[0];

let capturedFetchConfig: BatchLinkConfig | undefined;

vi.mock("@trpc/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof TRPCReactQuery>();
  return {
    ...actual,
    httpBatchLink: vi.fn((config: BatchLinkConfig) => {
      capturedFetchConfig = config;
      return actual.httpBatchLink(config);
    }),
  };
});

// A mutable mock object (not a static factory return) so individual tests can
// flip NEXT_PUBLIC_E2E_TEST_SECRET between renders without vi.resetModules()
// + a dynamic re-import - that combination made the V8 coverage provider lose
// track of client.tsx's own coverage entirely (multiple re-executions of the
// same module under different mock states confused its coverage map merge).
const mockPublicEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_API_URL: "http://localhost:8000",
  NEXT_PUBLIC_WEB_URL: "http://localhost:3000",
  NEXT_PUBLIC_E2E_TEST_SECRET: undefined as string | undefined,
}));

vi.mock("@/lib/env.client", () => ({ publicEnv: mockPublicEnv }));

import { buildE2EHeaders, TRPCProvider } from "@/lib/trpc/client";

afterEach(() => {
  vi.unstubAllGlobals();
  mockPublicEnv.NEXT_PUBLIC_E2E_TEST_SECRET = undefined;
});

describe("TRPCProvider", () => {
  it("renders children without crashing", () => {
    const { getByText } = render(
      <TRPCProvider>
        <div>Child</div>
      </TRPCProvider>,
    );
    expect(getByText("Child")).toBeInTheDocument();
  });

  it("forwards credentials and an explicit abort signal", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    render(
      <TRPCProvider>
        <div>Child</div>
      </TRPCProvider>,
    );
    const controller = new AbortController();
    await capturedFetchConfig?.fetch?.("http://localhost/trpc", {
      signal: controller.signal,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost/trpc",
      expect.objectContaining({ credentials: "include", signal: controller.signal }),
    );
  });

  it("falls back to a null signal when options are undefined", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    render(
      <TRPCProvider>
        <div>Child</div>
      </TRPCProvider>,
    );
    await capturedFetchConfig?.fetch?.("http://localhost/trpc", undefined);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost/trpc",
      expect.objectContaining({ credentials: "include", signal: null }),
    );
  });

  it("TRPCProvider wires buildE2EHeaders() into the batch link's headers", () => {
    mockPublicEnv.NEXT_PUBLIC_E2E_TEST_SECRET = "test-only-secret";
    render(
      <TRPCProvider>
        <div>Child</div>
      </TRPCProvider>,
    );
    expect(capturedFetchConfig?.headers).toEqual({ "x-e2e-secret": "test-only-secret" });
  });
});

describe("buildE2EHeaders", () => {
  it("returns the x-e2e-secret header when NEXT_PUBLIC_E2E_TEST_SECRET is set", () => {
    mockPublicEnv.NEXT_PUBLIC_E2E_TEST_SECRET = "test-only-secret";
    expect(buildE2EHeaders()).toEqual({ "x-e2e-secret": "test-only-secret" });
  });

  it("returns undefined when NEXT_PUBLIC_E2E_TEST_SECRET is unset", () => {
    expect(buildE2EHeaders()).toBeUndefined();
  });
});
