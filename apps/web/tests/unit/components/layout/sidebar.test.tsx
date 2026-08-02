import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/org-switcher", () => ({ OrgSwitcher: () => <p>OrgSwitcher</p> }));

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { NAV_ITEMS } from "@/lib/constants/navigation";

describe("Sidebar", () => {
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
});
