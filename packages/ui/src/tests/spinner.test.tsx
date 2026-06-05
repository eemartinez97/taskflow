import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "../spinner";

describe("Spinner", () => {
  it("renders with default accessible label", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<Spinner label="Fetching data" />);
    expect(screen.getByRole("status", { name: "Fetching data" })).toBeInTheDocument();
  });

  it("applies size classes", () => {
    render(<Spinner size="lg" label="Loading" />);
    expect(screen.getByRole("status")).toHaveClass("h-8");
  });
});
