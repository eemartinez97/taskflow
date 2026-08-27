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
  it("does not collapse when focus moves within the widget (e.g. to Cancel)", async () => {
    render(<AddTaskButton onAdd={vi.fn()} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.tab(); // Add is disabled while empty, so this lands on Cancel
    expect(screen.getByPlaceholderText(/task title/i)).toBeInTheDocument();
  });
  it("collapses when focus truly leaves the widget while empty", async () => {
    render(
      <>
        <AddTaskButton onAdd={vi.fn()} taskCount={0} />
        <button type="button">Outside</button>
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.click(screen.getByRole("button", { name: /outside/i }));
    expect(screen.queryByPlaceholderText(/task title/i)).not.toBeInTheDocument();
  });
  it("keeps the form open when focus leaves the widget with an unsaved draft", async () => {
    render(
      <>
        <AddTaskButton onAdd={vi.fn()} taskCount={0} />
        <button type="button">Outside</button>
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "Unsaved draft");
    await user.click(screen.getByRole("button", { name: /outside/i }));
    expect(screen.getByPlaceholderText(/task title/i)).toHaveValue("Unsaved draft");
  });
  it("re-focuses the input after submitting via the Add button, so it stays open", async () => {
    const onAdd = vi.fn();
    render(<AddTaskButton onAdd={onAdd} taskCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "New task");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByPlaceholderText(/task title/i)).toHaveFocus();
  });
});
