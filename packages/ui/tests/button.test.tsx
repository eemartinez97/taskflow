import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../src";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("is disabled when loading prop is true", () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        No click
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies fullWidth class when fullWidth prop is true", () => {
    render(<Button fullWidth>Wide</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });

  it("renders all variant classes without throwing", () => {
    const variants = ["primary", "secondary", "destructive", "ghost", "link"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole("button", { name: variant })).toBeInTheDocument();
      unmount();
    }
  });

  it("renders all size classes without throwing", () => {
    const sizes = ["sm", "md", "lg", "icon"] as const;
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>btn</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
      unmount();
    }
  });

  it("shows spinner when loading", () => {
    render(<Button loading>Saving</Button>);
    // The spinner SVG has aria-hidden so it's not in the asscessibility tree
    // We verify indirectly via aria-busy
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Styled</Button>);
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });
});
