import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/lib/trpc/client";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { mockUseQuery } from "@/tests/support/trpc";

describe("useNotifications", () => {
  it("returns the EMPTY default shape when data is undefined", () => {
    mockUseQuery(api.notifications.list, undefined);
    const { result } = renderHook(() => useNotifications());
    expect(result.current).toEqual({ notifications: [], unreadCount: 0 });
  });

  it("returns the fetched notifications data when present", () => {
    const data = { notifications: [{ id: "n1" }], unreadCount: 1 };
    mockUseQuery(api.notifications.list, data);
    const { result } = renderHook(() => useNotifications());
    expect(result.current).toEqual(data);
  });

  it("requests a 30s refetch interval", () => {
    renderHook(() => useNotifications());
    expect(api.notifications.list.useQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ refetchInterval: 30_000 }),
    );
  });
});
