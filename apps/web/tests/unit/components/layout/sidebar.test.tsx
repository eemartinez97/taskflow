import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation.js"));
vi.mock("next/link", () => import("@/tests/mocks/next-link.js"));

import { usePathname } from "@/tests/mocks/next-navigation";
import { Sidebar } from "@/components/layout/sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/dashboard/projects");
  });

  it("renders the TaskFlow logo link", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /taskflow/i })).toBeInTheDocument();
  });

  it("renders all nav items", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /team/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("marks the active nav item with aria-current='page'", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/projects");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /projects/i })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark inactive items with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/projects");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /tasks/i })).not.toHaveAttribute("aria-current");
  });

  it("active link has brand styling class", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /projects/i })).toHaveClass("bg-brand-50");
  });

  it("Projects link points to /dashboard/projects", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /projects/i })).toHaveAttribute(
      "href",
      "/dashboard/projects",
    );
  });

  it("renders inside an <aside> landmark", () => {
    render(<Sidebar />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders inside a <nav> landmark with accessible label", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });
});
