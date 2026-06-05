import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../badge";

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge>Beta</Badge>);
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("applies default variant styles", () => {
    render(<Badge data-testid="badge">Default</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("bg-brand-100");
  });

  it("applies destructive variant styles", () => {
    render(
      <Badge data-testid="badge" variant="destructive">
        Error
      </Badge>,
    );
    expect(screen.getByTestId("badge")).toHaveClass("bg-red-100");
  });

  it("renders all variants without throwing", () => {
    const variants = ["default", "success", "warning", "destructive", "outline"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });
});
