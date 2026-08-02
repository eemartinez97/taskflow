import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { AddColumnButton } from "@/components/kanban/add-column-button";
import { renderUI } from "../../helpers/render";

describe("AddColumnButton", () => {
  beforeEach(() => {
    // scrollIntoView is not implemented in jsdom
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // -- Collapsed state --

  it("renders the collapsed trigger button with aria-label 'Add column'", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);

    expect(screen.getByRole("button", { name: "Add column" })).toBeInTheDocument();
  });

  it("does not show the input in the collapsed state", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  // -- Expanding --

  it("shows the name input after clicking the trigger", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(screen.getByRole("textbox", { name: "New column name" })).toBeInTheDocument();
  });

  it("shows the Confirm and Cancel icon buttons when expanded", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(screen.getByRole("button", { name: "Confirm new column" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel new column" })).toBeInTheDocument();
  });

  // -- Submit via Enter --

  it("calls onAdd with the trimmed name when Enter is pressed", () => {
    const mockOnAdd = vi.fn();
    renderUI(<AddColumnButton onAdd={mockOnAdd} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const input = screen.getByRole("textbox", { name: "New column name" });
    fireEvent.change(input, { target: { value: "  In Review  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnAdd).toHaveBeenCalledWith("In Review");
  });

  it("clears the input text after submitting via Enter", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const input = screen.getByRole("textbox", { name: "New column name" });
    fireEvent.change(input, { target: { value: "In Review" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("");
  });

  it("does NOT call onAdd when Enter is pressed on an empty input", () => {
    const mockOnAdd = vi.fn();
    renderUI(<AddColumnButton onAdd={mockOnAdd} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const input = screen.getByRole("textbox", { name: "New column name" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  // -- Submit via Confirm button --

  it("calls onAdd when the Confirm icon button is clicked with a non-empty name", () => {
    const mockOnAdd = vi.fn();
    renderUI(<AddColumnButton onAdd={mockOnAdd} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    fireEvent.change(screen.getByRole("textbox", { name: "New column name" }), {
      target: { value: "Done" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm new column" }));

    expect(mockOnAdd).toHaveBeenCalledWith("Done");
  });

  it("the Confirm icon button is disabled when the input is empty", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(screen.getByRole("button", { name: "Confirm new column" })).toBeDisabled();
  });

  // -- Cancel via Escape --

  it("collapses back to the trigger when Escape is pressed", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const input = screen.getByRole("textbox", { name: "New column name" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Add column" })).toBeInTheDocument();
  });

  it("clears the typed name when collapsing via Escape", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const input = screen.getByRole("textbox", { name: "New column name" });
    fireEvent.change(input, { target: { value: "Partial" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Re-open: input must be empty
    expect(screen.getByRole("button", { name: "Add column" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add column" }));
    expect(screen.getByRole("textbox", { name: "New column name" })).toHaveValue("");
  });

  // -- Cancel via Cancel button --

  it("collapses back to the trigger when the Cancel icon button is clicked", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel new column" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  // -- Blur cancels when empty --

  it("collapses when the input loses focus while empty", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const input = screen.getByRole("textbox", { name: "New column name" });
    fireEvent.blur(input);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("does NOT collapse when the input loses focus while it has a value", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const input = screen.getByRole("textbox", { name: "New column name" });
    fireEvent.change(input, { target: { value: "In Progress" } });
    fireEvent.blur(input);

    expect(screen.getByRole("textbox", { name: "New column name" })).toBeInTheDocument();
  });

  // -- Loading state --

  it("disables the Confirm icon button when loading is true", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} loading />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    // Expand and type to rule out the empty-name disable
    fireEvent.change(screen.getByRole("textbox", { name: "New column name" }), {
      target: { value: "Sprint" },
    });

    expect(screen.getByRole("button", { name: "Confirm new column" })).toBeDisabled();
  });

  it("renders the 'Adding…' button when loading is true and expanded", () => {
    renderUI(<AddColumnButton onAdd={vi.fn()} columnCount={0} loading />);
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(screen.getByRole("button", { name: /adding/i })).toBeInTheDocument();
  });
});
