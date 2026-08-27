import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/org-switcher", () => ({ OrgSwitcher: () => <p>OrgSwitcher</p> }));

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { NAV_ITEMS } from "@/lib/constants/navigation";

describe("Sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it("starts expanded and toggles to collapsed on click, hiding the OrgSwitcher", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/projects");
    render(<Sidebar />);

    expect(screen.getByText("OrgSwitcher")).toBeInTheDocument();
    const toggleButton = screen.getByRole("button", { name: "Collapse sidebar" });

    await user.click(toggleButton);

    expect(screen.queryByText("OrgSwitcher")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    // Accessible name survives collapse (sr-only, not removed) so links stay reachable.
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("title", "Projects");
  });

  it("persists the collapsed state across remounts via localStorage", async () => {
    const user = userEvent.setup();
    vi.mocked(usePathname).mockReturnValue("/projects");
    const { unmount } = render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem("taskflow.sidebar.collapsed")).toBe("true");
    unmount();

    render(<Sidebar />);
    expect(await screen.findByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
