import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { type ShouldDehydrateFn, extractShouldDehydrate } from "@/tests/helpers";
import { getQueryClient, makeQueryClient } from "@/lib/trpc/query-client";

// Reset browser singleton between tests that manipulate `typeof window`
afterEach(() => vi.unstubAllGlobals());

describe("makeQueryClient", () => {
  it("returns a QueryClient instance", () => {
    expect(makeQueryClient()).toBeInstanceOf(QueryClient);
  });

  it("each call produces a fresh instance (no shared state)", () => {
    expect(makeQueryClient()).not.toBe(makeQueryClient());
  });

  it("configures all default options correctly", () => {
    const opts = makeQueryClient().getDefaultOptions();
    expect(opts.queries?.staleTime).toBe(30_000);
    expect(opts.queries?.gcTime).toBe(5 * 60_000);
    expect(opts.queries?.retry).toBe(1);
    expect(opts.queries?.refetchOnWindowFocus).toBe(false);
    expect(opts.dehydrate?.serializeData).toBeDefined();
    expect(opts.hydrate?.deserializeData).toBeDefined();
  });

  describe("shouldDehydrateQuery", () => {
    let shouldDehydrate: ShouldDehydrateFn;

    beforeEach(() => {
      shouldDehydrate = extractShouldDehydrate(makeQueryClient());
    });

    it.each<[string, boolean]>([
      ["success", true], // defaultShouldDehydrateQuery branch
      ["pending", true], // our extension branch
      ["error", false], // both branches false
    ])("status '%s' → %s", (status, expected) => {
      expect(shouldDehydrate({ state: { status } })).toBe(expected);
    });
  });
});

describe("getQueryClient", () => {
  it("returns a QueryClient instance", () => {
    expect(getQueryClient()).toBeInstanceOf(QueryClient);
  });

  it("browser: returns the SAME instance on every calls (singleton)", () => {
    const a = getQueryClient();
    const b = getQueryClient();
    expect(a).toBe(b);
  });

  it("server: returns a NEW instance on each call (no shared state across requests)", () => {
    vi.stubGlobal("window", undefined);
    expect(getQueryClient()).not.toBe(getQueryClient);
  });
});
