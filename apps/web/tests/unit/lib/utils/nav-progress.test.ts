import { afterEach, describe, expect, it, vi } from "vitest";

import {
  endNavProgress,
  getNavProgress,
  getServerNavProgress,
  startNavProgress,
  subscribeNavProgress,
} from "@/lib/utils/nav-progress";

afterEach(() => {
  // Drain any active state left by a previous test.
  endNavProgress();
});

describe("nav-progress store", () => {
  it("starts inactive", () => {
    expect(getNavProgress()).toBe(false);
  });

  it("startNavProgress sets active to true and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNavProgress(listener);
    startNavProgress();
    expect(getNavProgress()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("startNavProgress is a no-op when already active", () => {
    const listener = vi.fn();
    startNavProgress();
    const unsubscribe = subscribeNavProgress(listener);
    startNavProgress();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("endNavProgress sets active to false and notifies subscribers", () => {
    startNavProgress();
    const listener = vi.fn();
    const unsubscribe = subscribeNavProgress(listener);
    endNavProgress();
    expect(getNavProgress()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("endNavProgress is a no-op when already inactive", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNavProgress(listener);
    endNavProgress();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNavProgress(listener);
    unsubscribe();
    startNavProgress();
    expect(listener).not.toHaveBeenCalled();
  });

  it("getServerNavProgress always returns false", () => {
    startNavProgress();
    expect(getServerNavProgress()).toBe(false);
  });
});
