import { describe, expect, it, vi } from "vitest";

import { getQueryClient, makeQueryClient } from "@/lib/trpc/query-client";
import { toast } from "@/lib/toast/store";

describe("makeQueryClient", () => {
  it("shows an error toast on mutation failure unless skipErrorToast is set", () => {
    const client = makeQueryClient();
    const cache = client.getMutationCache();
    const onError = cache.config.onError;
    onError?.(new Error("boom"), undefined, undefined, { meta: {} } as never, undefined as never);
    expect(toast.error).toHaveBeenCalledWith("boom");
  });

  it("falls back to a generic message when the error has no message", () => {
    const client = makeQueryClient();
    const onError = client.getMutationCache().config.onError;
    onError?.(new Error(""), undefined, undefined, { meta: {} } as never, undefined as never);
    expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.");
  });

  it("skips the toast when mutation.meta.skipErrorToast is true", () => {
    const client = makeQueryClient();
    const onError = client.getMutationCache().config.onError;
    onError?.(
      new Error("boom"),
      undefined,
      undefined,
      { meta: { skipErrorToast: true } } as never,
      undefined as never,
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("applies SSR-safe query defaults", () => {
    const client = makeQueryClient();
    const defaults = client.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(30_000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });
});

describe("getQueryClient", () => {
  it("returns a fresh client every call on the server", () => {
    vi.stubGlobal("window", undefined);
    const a = getQueryClient();
    const b = getQueryClient();
    expect(a).not.toBe(b);
    vi.unstubAllGlobals();
  });

  it("returns the same singleton client on the browser", () => {
    const a = getQueryClient();
    const b = getQueryClient();
    expect(a).toBe(b);
  });
});
