import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import {
  getServerHydratedSnapshot,
  isFreshLoadingQuery,
  useGlobalLoading,
} from "@/lib/hooks/use-global-loading";
import { endNavProgress, startNavProgress } from "@/lib/utils/nav-progress";

afterEach(() => {
  endNavProgress();
});

describe("isFreshLoadingQuery", () => {
  it("is true for a fetching query with no cached data", () => {
    expect(isFreshLoadingQuery({ state: { fetchStatus: "fetching", data: undefined } })).toBe(true);
  });

  it("is false for a background refetch of already-cached data", () => {
    expect(isFreshLoadingQuery({ state: { fetchStatus: "fetching", data: { x: 1 } } })).toBe(false);
  });

  it("is false for an idle query", () => {
    expect(isFreshLoadingQuery({ state: { fetchStatus: "idle", data: undefined } })).toBe(false);
  });
});

describe("getServerHydratedSnapshot", () => {
  it("always returns false", () => {
    expect(getServerHydratedSnapshot()).toBe(false);
  });
});

describe("useGlobalLoading", () => {
  it("is false when nothing is loading", () => {
    const { result } = renderHook(() => useGlobalLoading());
    expect(result.current).toBe(false);
  });

  it("is true while a navigation is active", () => {
    startNavProgress();
    const { result } = renderHook(() => useGlobalLoading());
    expect(result.current).toBe(true);
  });

  it("is true while a mutation is pending", () => {
    vi.mocked(useIsMutating).mockReturnValue(1);
    const { result } = renderHook(() => useGlobalLoading());
    expect(result.current).toBe(true);
  });

  it("is true while a query with no cached data is fetching", () => {
    vi.mocked(useIsFetching).mockReturnValue(1);
    const { result } = renderHook(() => useGlobalLoading());
    expect(result.current).toBe(true);
  });
});
