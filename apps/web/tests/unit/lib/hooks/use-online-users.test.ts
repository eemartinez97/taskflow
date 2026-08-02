import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOnlineUsers } from "@/lib/hooks/use-online-users";
import { setOnlineUsers } from "@/lib/socket/presence-store";

describe("useOnlineUsers", () => {
  it("reflects the presence store's current roster", () => {
    setOnlineUsers(["u1", "u2"]);
    const { result } = renderHook(() => useOnlineUsers());
    expect(result.current.has("u1")).toBe(true);
  });
});
