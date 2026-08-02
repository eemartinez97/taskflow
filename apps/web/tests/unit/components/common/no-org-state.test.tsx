import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoOrgState } from "@/components/common/no-org-state";

describe("NoOrgState", () => {
  it("renders the base heading without context", () => {
    render(<NoOrgState />);
    expect(screen.getByText(/not part of any organization/i)).toBeInTheDocument();
  });

  it("renders the optional context message when provided", () => {
    render(<NoOrgState context="Custom context message" />);
    expect(screen.getByText("Custom context message")).toBeInTheDocument();
  });

  it("links to /onboarding", () => {
    render(<NoOrgState />);
    expect(screen.getByRole("link", { name: /or create one/i })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });
});
