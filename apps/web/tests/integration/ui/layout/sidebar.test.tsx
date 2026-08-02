import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { NAV_ITEMS } from "@/lib/constants/navigation";
import { renderUI } from "../../helpers/render";

// OrgSwitcher has its own dedicated test file - mock it here
// to keep Sidebar tests focused on Sidebar's own responsibilities.
vi.mock("@/components/layout/org-switcher", () => ({
  OrgSwitcher: () => <div data-testid="org-switcher-mock" />,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  // -- Brand link --

  it("renders the TaskFlow brand link pointing to /projects", () => {
    renderUI(<Sidebar />);

    const link = screen.getByRole("link", { name: /taskflow/i });
    expect(link).toHaveAttribute("href", "/projects");
  });

  // -- Navigation items --

  it.each(NAV_ITEMS)("renders the '$label' nav link with href '$href'", ({ label, href }) => {
    renderUI(<Sidebar />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("renders all nav items (one per NAV_ITEMS entry)", () => {
    renderUI(<Sidebar />);

    // Brand link + one per NAV_ITEM
    expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(NAV_ITEMS.length + 1);
  });

  it("wraps nav links in a landmark with label 'Main navigation'", () => {
    renderUI(<Sidebar />);

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });

  // -- Active state --

  it.each(NAV_ITEMS)(
    "sets aria-current='page' on '$label' when pathname starts with '$href'",
    ({ label, href }) => {
      vi.mocked(usePathname).mockReturnValue(href);
      renderUI(<Sidebar />);

      expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    },
  );

  it("does not set aria-current on any item when pathname matches no nav item", () => {
    vi.mocked(usePathname).mockReturnValue("/unrecognized-route");
    renderUI(<Sidebar />);

    for (const { label } of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  it("sets aria-current only on the active item and not on siblings", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    renderUI(<Sidebar />);

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");

    for (const { label, href } of NAV_ITEMS) {
      if (href === "/projects") continue;
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  // -- OrgSwitcher --

  it("renders the OrgSwitcher inside the sidebar", () => {
    renderUI(<Sidebar />);

    expect(screen.getByTestId("org-switcher-mock")).toBeInTheDocument();
  });
});
