import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JSX } from "react";

/**
 * DashboardLayout is a SYNCHRONOUS Server Component.
 * Auth is handled upstream by proxy.ts — no requireSession, no redirect here.
 *
 * Sidebar and Header are mocked inline so we test the layout structure only,
 * not the behavior of its child components (which have their own test files).
 */
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: (): JSX.Element => <aside data-testid="sidebar" />,
}));
vi.mock("@/components/layout/header", () => ({
  Header: ({ title }: { title: string }): JSX.Element => (
    <header data-testid="header">{title}</header>
  ),
}));

import DashboardLayout from "@/app/(dashboard)/layout";

describe("DashboardLayout", () => {
  it("renders children", () => {
    render(DashboardLayout({ children: <p>page content</p> }));
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("renders a <main> element with id='main-content'", () => {
    render(DashboardLayout({ children: <span /> }));
    expect(document.getElementById("main-content")).toBeInTheDocument();
  });

  it("renders children inside the <main> element", () => {
    render(DashboardLayout({ children: <p data-testid="child">hello</p> }));
    expect(
      document.getElementById("main-content")?.querySelector("[data-testid='child']"),
    ).toBeInTheDocument();
  });

  it("renders the sidebar", () => {
    render(DashboardLayout({ children: <span /> }));
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders the header", () => {
    render(DashboardLayout({ children: <span /> }));
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("does not throw for any ReactNode children type", () => {
    expect(() => render(DashboardLayout({ children: null }))).not.toThrow();
    expect(() => render(DashboardLayout({ children: "text" }))).not.toThrow();
    expect(() => render(DashboardLayout({ children: <div /> }))).not.toThrow();
  });
});
