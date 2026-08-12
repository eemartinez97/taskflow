import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation"));

import { useAppRouter } from "@/lib/hooks/use-app-router";
import { endNavProgress, getNavProgress } from "@/lib/utils/nav-progress";
import { setupRouterMock } from "@/tests/support/render";

afterEach(() => {
  endNavProgress();
});

describe("useAppRouter", () => {
  it("starts nav progress synchronously the moment push is called", () => {
    const { pushMock } = setupRouterMock();
    const { result } = renderHook(() => useAppRouter());

    act(() => {
      result.current.push("/projects");
      // Checked INSIDE the act() callback, before its post-callback flush
      // runs the effect that clears it - startNavProgress() itself is a
      // plain synchronous call, not gated by React's commit cycle.
      expect(getNavProgress()).toBe(true);
    });

    expect(pushMock).toHaveBeenCalledWith("/projects");
  });

  it("clears nav progress once the push transition settles", async () => {
    setupRouterMock();
    const { result } = renderHook(() => useAppRouter());

    act(() => {
      result.current.push("/projects");
    });

    await waitFor(() => {
      expect(getNavProgress()).toBe(false);
    });
  });

  it("forwards options to push when provided", () => {
    const { pushMock } = setupRouterMock();
    const { result } = renderHook(() => useAppRouter());

    act(() => {
      result.current.push("/projects", { scroll: false });
    });

    expect(pushMock).toHaveBeenCalledWith("/projects", { scroll: false });
  });

  it("starts nav progress and calls refresh() the same way as push", async () => {
    const { refreshMock } = setupRouterMock();
    const { result } = renderHook(() => useAppRouter());

    act(() => {
      result.current.refresh();
      expect(getNavProgress()).toBe(true);
    });

    expect(refreshMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(getNavProgress()).toBe(false);
    });
  });

  it("passes through the router's other methods unchanged", () => {
    const { router } = setupRouterMock();
    const { result } = renderHook(() => useAppRouter());

    expect(result.current.replace).toBe(router.replace);
    expect(result.current.back).toBe(router.back);
    expect(result.current.forward).toBe(router.forward);
    expect(result.current.prefetch).toBe(router.prefetch);
  });
});
