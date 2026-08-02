import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { AddTaskButton } from "@/components/kanban/add-task-button";
import { renderUI } from "../../helpers/render";

describe("AddTaskButton", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // -- Collapsed state --

  it("renders the collapsed 'Add task' button", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);

    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  it("does not show the title input in the collapsed state", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);

    expect(screen.queryByPlaceholderText("Task title")).not.toBeInTheDocument();
  });

  // -- Expanding --

  it("shows the title input and Add/Cancel buttons after clicking 'Add task'", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByPlaceholderText("Task title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // -- Submit via Enter --

  it("calls onAdd with the trimmed title when Enter is pressed", () => {
    const mockOnAdd = vi.fn();
    renderUI(<AddTaskButton onAdd={mockOnAdd} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    const input = screen.getByPlaceholderText("Task title");
    fireEvent.change(input, { target: { value: "  Fix login bug  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnAdd).toHaveBeenCalledWith("Fix login bug");
  });

  it("clears the input after submitting via Enter", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    const input = screen.getByPlaceholderText("Task title");
    fireEvent.change(input, { target: { value: "New task" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("");
  });

  it("does NOT call onAdd when Enter is pressed on an empty input", () => {
    const mockOnAdd = vi.fn();
    renderUI(<AddTaskButton onAdd={mockOnAdd} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    fireEvent.keyDown(screen.getByPlaceholderText("Task title"), { key: "Enter" });

    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  // -- Submit via Add button --

  it("calls onAdd when the Add button is clicked with a non-empty title", () => {
    const mockOnAdd = vi.fn();
    renderUI(<AddTaskButton onAdd={mockOnAdd} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    fireEvent.change(screen.getByPlaceholderText("Task title"), {
      target: { value: "Design landing page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockOnAdd).toHaveBeenCalledWith("Design landing page");
  });

  it("the Add button is disabled when the title input is empty", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("enables the Add button once a non-empty title is typed", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    fireEvent.change(screen.getByPlaceholderText("Task title"), {
      target: { value: "New task" },
    });

    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });

  // -- Cancel via Escape --

  it("collapses back to the 'Add task' button when Escape is pressed", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    fireEvent.keyDown(screen.getByPlaceholderText("Task title"), { key: "Escape" });

    expect(screen.queryByPlaceholderText("Task title")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  it("clears any typed text when collapsing via Escape", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    const input = screen.getByPlaceholderText("Task title");
    fireEvent.change(input, { target: { value: "Partial title" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();

    // Re-open: input must start empty
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByPlaceholderText("Task title")).toHaveValue("");
  });

  // -- Cancel via Cancel button --

  it("collapses back to the 'Add task' button when Cancel is clicked", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByPlaceholderText("Task title")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  // -- Blur cancels when empty --

  it("collapses when the title input loses focus while empty", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    fireEvent.blur(screen.getByPlaceholderText("Task title"));

    expect(screen.queryByPlaceholderText("Task title")).not.toBeInTheDocument();
  });

  it("does NOT collapse when the title input loses focus with a non-empty value", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    const input = screen.getByPlaceholderText("Task title");
    fireEvent.change(input, { target: { value: "In progress task" } });
    fireEvent.blur(input);

    expect(screen.getByPlaceholderText("Task title")).toBeInTheDocument();
  });

  // -- Loading state --

  it("shows the Add button in loading/disabled state when loading=true", () => {
    renderUI(<AddTaskButton onAdd={vi.fn()} taskCount={0} loading />);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    // With loading=true the mock renders the button as disabled
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});
