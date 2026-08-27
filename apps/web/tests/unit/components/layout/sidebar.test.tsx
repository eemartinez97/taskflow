import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/org-switcher", () => ({
  OrgSwitcher: ({ collapsed }: { collapsed?: boolean }) =>
    collapsed ? <p>OrgSwitcher-collapsed</p> : <p>OrgSwitcher</p>,
}));

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SIDEBAR_COLLAPSE_COOKIE } from "@/lib/utils/sidebar-collapse-cookie";
import { NAV_ITEMS } from "@/lib/constants/navigation";

function clearCookie(): void {
  document.cookie = `${SIDEBAR_COLLAPSE_COOKIE}=; path=/; max-age=0`;
}

describe("Sidebar", () => {
  beforeEach(clearCookie);

  it("renders every nav item as a link with the correct href", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    render(<Sidebar />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("marks the active route with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/tasks");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  it("renders the OrgSwitcher", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    render(<Sidebar />);
    expect(screen.getByText("OrgSwitcher")).toBeInTheDocument();
  });

  it("links the brand logo to /projects", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /taskflow/i })).toHaveAttribute("href", "/projects");
  });

  it("starts expanded and toggles to collapsed on click, switching the OrgSwitcher to its compact mode", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/projects");
    render(<Sidebar />);

    expect(screen.getByText("OrgSwitcher")).toBeInTheDocument();
    const toggleButton = screen.getByRole("button", { name: "Collapse sidebar" });

    await user.click(toggleButton);

    expect(screen.queryByText("OrgSwitcher")).not.toBeInTheDocument();
    expect(screen.getByText("OrgSwitcher-collapsed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    // Accessible name survives collapse (sr-only, not removed) so links stay reachable.
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("title", "Projects");
  });

  it("keeps the toggle button's visible label in sync with its state", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/projects");
    render(<Sidebar />);

    const toggleButton = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggleButton).toHaveTextContent("Collapse");

    await user.click(toggleButton);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveTextContent("Expand");
  });

  it("persists the collapsed state across remounts via the cookie", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/projects");
    const { unmount } = render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(document.cookie).toContain(`${SIDEBAR_COLLAPSE_COOKIE}=true`);
    unmount();

    render(<Sidebar />);
    expect(await screen.findByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
