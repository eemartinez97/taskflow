import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getServerSnapshot, useSidebarCollapse } from "@/lib/hooks/use-sidebar-collapse";

const STORAGE_KEY = "taskflow.sidebar.collapsed";

describe("useSidebarCollapse", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("getServerSnapshot always reports expanded", () => {
    expect(getServerSnapshot()).toBe(false);
  });

  it("defaults to expanded when nothing is stored", () => {
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it("reads a previously persisted collapsed state on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(true);
  });

  it("treats any non-'true' stored value as expanded", () => {
    window.localStorage.setItem(STORAGE_KEY, "false");
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle() flips collapsed and persists the new value", () => {
    const { result } = renderHook(() => useSidebarCollapse());

    act(() => {
      result.current.toggle();
    });
    expect(result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");

    act(() => {
      result.current.toggle();
    });
    expect(result.current.collapsed).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
  });
});
