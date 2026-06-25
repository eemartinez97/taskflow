import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "../src";
import userEvent from "@testing-library/user-event";

describe("Select", () => {
  it("renders a select element", () => {
    render(
      <Select aria-label="Choose option">
        <option value="a">Option A</option>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "Choose option" })).toBeInTheDocument();
  });

  it("renders all option children", () => {
    render(
      <Select aria-label="Status">
        <option value="todo">To Do</option>
        <option value="done">Done</option>
      </Select>,
    );
    expect(screen.getByRole("option", { name: "To Do" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Done" })).toBeInTheDocument();
  });

  it("reflects selected value", async () => {
    render(
      <Select aria-label="Priority" defaultValue="low">
        <option value="low">Low</option>
        <option value="high">High</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Priority" });
    expect(select).toHaveValue("low");
    await userEvent.selectOptions(select, "high");
    expect(select).toHaveValue("high");
  });

  it("calls onChange when a new option is selected", async () => {
    const handleChange = vi.fn();
    render(
      <Select aria-label="Pick" onChange={handleChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "b");
    expect(handleChange).toHaveBeenCalled();
  });

  it("is disabled when disabled prop is passed", () => {
    render(
      <Select aria-label="Disabled select" disabled>
        <option value="x">X</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("applies error border styles when hasError is true", () => {
    render(
      <Select aria-label="Error select" hasError>
        <option value="x">X</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveClass("border-red-500");
  });

  it("applies default border styles when hasError is false", () => {
    render(
      <Select aria-label="Normal select">
        <option value="x">X</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveClass("border-gray-300");
    expect(screen.getByRole("combobox")).not.toHaveClass("border-red-500");
  });

  it("merges custom className", () => {
    render(
      <Select aria-label="Custom" className="w-48">
        <option value="x">X</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveClass("w-48");
  });
});
