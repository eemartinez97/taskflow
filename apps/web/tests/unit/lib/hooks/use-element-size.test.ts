import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElementSize } from "@/lib/hooks/use-element-size";

let observerCallback: ResizeObserverCallback | undefined;

beforeEach(() => {
  observerCallback = undefined;
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) {
      observerCallback = cb;
    }
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useElementSize", () => {
  it("returns 0,0 when ref.current is null", () => {
    const ref = { current: null };
    const { result } = renderHook(() => useElementSize(ref));
    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it("reads clientWidth/clientHeight on mount and observes the element", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 100 });
    Object.defineProperty(el, "clientHeight", { value: 200 });
    const ref = { current: el };
    const { result } = renderHook(() => useElementSize(ref));
    expect(result.current).toEqual({ width: 100, height: 200 });
  });

  it("disconnects the observer on unmount", () => {
    const el = document.createElement("div");
    const ref = { current: el };
    const { unmount } = renderHook(() => useElementSize(ref));
    unmount();
  });

  it("updates size when ResizeObserver fires", () => {
    const el = document.createElement("div");
    const ref = { current: el };
    const { result } = renderHook(() => useElementSize(ref));

    act(() => {
      observerCallback?.(
        [{ contentRect: { width: 500, height: 500 } } as unknown as ResizeObserverEntry],
        {} as unknown as ResizeObserver,
      );
    });

    expect(result.current).toEqual({ width: 500, height: 500 });
  });

  it("ignores a ResizeObserver callback with no entries", () => {
    const el = document.createElement("div");
    const ref = { current: el };
    const { result } = renderHook(() => useElementSize(ref));
    act(() => {
      observerCallback?.([], {} as unknown as ResizeObserver);
    });
    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it("does not update state when the new size matches the previous size", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 300 });
    Object.defineProperty(el, "clientHeight", { value: 300 });
    const ref = { current: el };
    const { result } = renderHook(() => useElementSize(ref));
    act(() => {
      observerCallback?.(
        [{ contentRect: { width: 300, height: 300 } } as unknown as ResizeObserverEntry],
        {} as unknown as ResizeObserver,
      );
    });
    expect(result.current).toEqual({ width: 300, height: 300 });
  });
});
