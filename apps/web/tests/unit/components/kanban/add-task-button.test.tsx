import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AddTaskButton } from "@/components/kanban/add-task-button";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("AddTaskButton", () => {
  it("shows the collapsed trigger initially", () => {
    render(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument();
  });
  it("expands the form on click", async () => {
    render(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /add task/i }));
    expect(screen.getByPlaceholderText(/task title/i)).toBeInTheDocument();
  });
  it("submits on Enter with the trimmed title", async () => {
    const onAdd = vi.fn();
    render(<AddTaskButton onAdd={onAdd} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "  New task  {Enter}");
    expect(onAdd).toHaveBeenCalledWith("New task");
  });
  it("submits via the Add button", async () => {
    const onAdd = vi.fn();
    render(<AddTaskButton onAdd={onAdd} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "New task");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onAdd).toHaveBeenCalledWith("New task");
  });
  it("does not submit a blank title", async () => {
    const onAdd = vi.fn();
    render(<AddTaskButton onAdd={onAdd} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "   {Enter}");
    expect(onAdd).not.toHaveBeenCalled();
  });
  it("cancels and collapses via the Cancel button", async () => {
    render(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "Some draft");
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/task title/i)).not.toBeInTheDocument();
    // Re-opening must show an empty field, proving setTitle("") actually ran.
    await user.click(screen.getByRole("button", { name: /add task/i }));
    expect(screen.getByPlaceholderText(/task title/i)).toHaveValue("");
  });
  it("collapses on Escape", async () => {
    render(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText(/task title/i)).not.toBeInTheDocument();
  });
  it("collapses on blur with an empty value", async () => {
    render(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.tab();
    expect(screen.queryByPlaceholderText(/task title/i)).not.toBeInTheDocument();
  });
});
