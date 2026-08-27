import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/sidebar-server", () => ({ SidebarServer: () => <div>Sidebar</div> }));
vi.mock("@/components/layout/header", () => ({ Header: () => <div>Header</div> }));

import DashboardLayout from "@/app/(dashboard)/layout";

describe("DashboardLayout", () => {
  it("renders Sidebar, Header and children inside Suspense boundaries", () => {
    render(
      <DashboardLayout>
        <p>Page content</p>
      </DashboardLayout>,
    );
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
