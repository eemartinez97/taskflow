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

import { TRPCProvider } from "@/lib/trpc/client";

afterEach(() => {
  vi.unstubAllGlobals();
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
});
