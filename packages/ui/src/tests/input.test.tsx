import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("accepts user input", async () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Hello");
    expect(input).toHaveValue("Hello");
  });

  it("applies error styles when hasError is true", () => {
    render(<Input hasError />);
    expect(screen.getByRole("textbox")).toHaveClass("border-red-500");
  });

  it("does not apply error styles by default", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    // Verify both the correct border and ring classes are absent
    expect(input).not.toHaveClass("border-red-500");
    expect(input).not.toHaveClass("focus-visible:ring-red-500");
  });

  it("is disabled when disabled prop is passed", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("calls onChange handler when value changes", async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "a");
    expect(handleChange).toHaveBeenCalled();
  });

  it("merges custom className", () => {
    render(<Input className="my-custom" />);
    expect(screen.getByRole("textbox")).toHaveClass("my-custom");
  });
});
