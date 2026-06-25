import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "../src";

describe("Label", () => {
  it("renders its children", () => {
    render(<Label>Email address</Label>);
    expect(screen.getByText("Email address")).toBeInTheDocument();
  });

  it("renders required asterisk when required prop is true", () => {
    render(<Label required>Username</Label>);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("does not render asterisk when required is false", () => {
    render(<Label>Optional field</Label>);
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("associates with input via htmlFor", () => {
    render(
      <>
        <Label htmlFor="my-input">My label</Label>
        <input id="my-input" />
      </>,
    );

    // Verify the label element itself carries the correct `for` attribute
    const label = screen.getByText("My label", { selector: "label" });
    expect(label).toHaveAttribute("for", "my-input");
  });
});
