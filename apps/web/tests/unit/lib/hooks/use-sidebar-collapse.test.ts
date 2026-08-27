import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSidebarCollapse } from "@/lib/hooks/use-sidebar-collapse";
import { SIDEBAR_COLLAPSE_COOKIE } from "@/lib/utils/sidebar-collapse-cookie";

function clearCookie(): void {
  document.cookie = `${SIDEBAR_COLLAPSE_COOKIE}=; path=/; max-age=0`;
}

describe("useSidebarCollapse", () => {
  beforeEach(clearCookie);
  afterEach(clearCookie);

  it("defaults to expanded when nothing is stored", () => {
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it("reads a previously persisted collapsed state on mount", () => {
    document.cookie = `${SIDEBAR_COLLAPSE_COOKIE}=true; path=/`;
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(true);
  });

  it("treats any non-'true' stored value as expanded", () => {
    document.cookie = `${SIDEBAR_COLLAPSE_COOKIE}=false; path=/`;
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle() flips collapsed and persists the new value", () => {
    const { result } = renderHook(() => useSidebarCollapse());

    act(() => {
      result.current.toggle();
    });
    expect(result.current.collapsed).toBe(true);
    expect(document.cookie).toContain(`${SIDEBAR_COLLAPSE_COOKIE}=true`);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.collapsed).toBe(false);
    expect(document.cookie).toContain(`${SIDEBAR_COLLAPSE_COOKIE}=false`);
  });
});
