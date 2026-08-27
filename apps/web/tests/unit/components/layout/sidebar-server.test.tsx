import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/tests/mocks/next-headers"));
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({ initialCollapsed }: { initialCollapsed?: boolean }) => (
    <p>Sidebar initialCollapsed={String(initialCollapsed)}</p>
  ),
}));

import { cookies } from "next/headers";
import { SidebarServer } from "@/components/layout/sidebar-server";
import { SIDEBAR_COLLAPSE_COOKIE } from "@/lib/utils/sidebar-collapse-cookie";
import { makeCookies } from "@/tests/mocks/next-headers";

describe("SidebarServer", () => {
  it("passes initialCollapsed=true when the cookie is 'true'", async () => {
    vi.mocked(cookies).mockResolvedValue(
      makeCookies({ [SIDEBAR_COLLAPSE_COOKIE]: "true" }) as never,
    );
    render(await SidebarServer());
    expect(screen.getByText("Sidebar initialCollapsed=true")).toBeInTheDocument();
  });

  it("passes initialCollapsed=false when the cookie is absent", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookies({}) as never);
    render(await SidebarServer());
    expect(screen.getByText("Sidebar initialCollapsed=false")).toBeInTheDocument();
  });

  it("passes initialCollapsed=false when the cookie value isn't 'true'", async () => {
    vi.mocked(cookies).mockResolvedValue(
      makeCookies({ [SIDEBAR_COLLAPSE_COOKIE]: "false" }) as never,
    );
    render(await SidebarServer());
    expect(screen.getByText("Sidebar initialCollapsed=false")).toBeInTheDocument();
  });
});
