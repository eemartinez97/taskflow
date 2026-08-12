import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardContent } from "@/components/layout/dashboard-content";
import { endNavProgress, startNavProgress } from "@/lib/utils/nav-progress";

afterEach(() => {
  endNavProgress();
});

describe("DashboardContent", () => {
  it("renders children without dimming while idle", () => {
    render(
      <DashboardContent>
        <p>Hello</p>
      </DashboardContent>,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hello").parentElement).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("Hello").parentElement).not.toHaveClass("opacity-50");
  });

  it("dims content and marks aria-busy while a navigation is in flight", () => {
    render(
      <DashboardContent>
        <p>Hello</p>
      </DashboardContent>,
    );

    act(() => {
      startNavProgress();
    });

    expect(screen.getByText("Hello").parentElement).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Hello").parentElement).toHaveClass(
      "opacity-50",
      "pointer-events-none",
    );
  });

  it("clears dimming once navigation ends", () => {
    render(
      <DashboardContent>
        <p>Hello</p>
      </DashboardContent>,
    );

    act(() => {
      startNavProgress();
    });
    act(() => {
      endNavProgress();
    });

    expect(screen.getByText("Hello").parentElement).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("Hello").parentElement).not.toHaveClass("opacity-50");
  });
});
