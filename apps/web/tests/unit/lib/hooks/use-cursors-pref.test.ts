import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";
import { CURSORS_PREF_COOKIE, setCursorsHidden } from "@/lib/utils/cursor-pref";

afterEach(() => {
  document.cookie = `${CURSORS_PREF_COOKIE}=; path=/; max-age=0`;
});

describe("useCursorsHidden", () => {
  it("reflects the cookie-backed store's current value", () => {
    setCursorsHidden(true);
    const { result } = renderHook(() => useCursorsHidden());
    expect(result.current).toBe(true);
  });
});
