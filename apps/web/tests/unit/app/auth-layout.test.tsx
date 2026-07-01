import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AuthLayout from "@/app/(auth)/layout";

describe("AuthLayout", () => {
  it("renders children inside the layout", () => {
    render(
      <AuthLayout>
        <span data-testid="child">content</span>
      </AuthLayout>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <AuthLayout>
        <p data-testid="a">A</p>
        <p data-testid="b">B</p>
      </AuthLayout>,
    );
    expect(screen.getByTestId("a")).toBeInTheDocument();
    expect(screen.getByTestId("b")).toBeInTheDocument();
  });

  it("wraps content in a full-height container", () => {
    const { container } = render(<AuthLayout>inner</AuthLayout>);
    // The outer div uses min-h-screen for full-height centering
    const outer = container.firstElementChild;
    expect(outer?.className).toMatch(/min-h-screen/);
  });

  it("contains content to max-w-md width", () => {
    const { container } = render(<AuthLayout>inner</AuthLayout>);
    const inner = container.querySelector(".max-w-md");
    expect(inner).toBeInTheDocument();
  });
});
