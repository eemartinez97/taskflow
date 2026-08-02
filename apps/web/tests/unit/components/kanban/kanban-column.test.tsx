import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities"));

import { KanbanColumn } from "@/components/kanban/kanban-column";
import { makeColumn, makeTask } from "@/tests/support/factories";

const column = makeColumn({ name: "To Do" });
const task = makeTask();

const defaultProps = {
  column,
  tasks: [task],
  isOver: false,
  onAddTask: vi.fn(),
  onTaskClick: vi.fn(),
  onRenameColumn: vi.fn(),
  onDeleteColumn: vi.fn(),
  assigneeById: new Map(),
  addingTaskId: null,
  labelsByTask: {},
};

describe("KanbanColumn", () => {
  it("renders the column name and task count", () => {
    render(<KanbanColumn {...defaultProps} />);
    expect(screen.getByLabelText(/column name/i)).toHaveValue("To Do");
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders every task as a KanbanCard", () => {
    render(<KanbanColumn {...defaultProps} />);
    expect(screen.getByTestId(`task-card-${task.id}`)).toBeInTheDocument();
  });

  it("calls onRenameColumn on blur of the inline-edit name field", async () => {
    const onRenameColumn = vi.fn();
    render(<KanbanColumn {...defaultProps} onRenameColumn={onRenameColumn} />);
    const input = screen.getByLabelText(/column name/i);
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, "Renamed");
    input.blur();
    expect(onRenameColumn).toHaveBeenCalledWith(column.id, "Renamed");
  });

  it("calls onTaskClick when a task card is clicked", async () => {
    const onTaskClick = vi.fn();
    render(<KanbanColumn {...defaultProps} onTaskClick={onTaskClick} />);
    await userEvent.setup().click(screen.getByTestId(`task-card-${task.id}`));
    expect(onTaskClick).toHaveBeenCalledWith(task);
  });

  it("calls onDeleteColumn via the options dropdown", async () => {
    const onDeleteColumn = vi.fn();
    render(<KanbanColumn {...defaultProps} onDeleteColumn={onDeleteColumn} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /options for column to do/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete column/i }));
    expect(onDeleteColumn).toHaveBeenCalledWith(column);
  });

  it("applies the drop-target highlight class when isOver is true", () => {
    const { container } = render(<KanbanColumn {...defaultProps} isOver />);
    expect(container.querySelector("[data-column-scroll]")).toHaveClass("bg-brand-50");
  });

  it("calls onAddTask with the column id and title", async () => {
    const onAddTask = vi.fn();
    render(<KanbanColumn {...defaultProps} onAddTask={onAddTask} tasks={[]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "New task{Enter}");
    expect(onAddTask).toHaveBeenCalledWith(column.id, "New task");
  });

  it("applies dragging opacity when this column is being dragged", async () => {
    const { useSortable } = await import("@dnd-kit/sortable");
    vi.mocked(useSortable).mockReturnValueOnce({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: true,
    } as never);
    render(<KanbanColumn {...defaultProps} />);
    expect(screen.getByTestId(`column-${column.id}`)).toHaveClass("opacity-50");
  });

  it("resolves the assignee via assigneeById when the task has an assigneeId", () => {
    const assigneeMap = new Map([["u1", { name: "Alice", email: "a@x.com" }]]);
    render(
      <KanbanColumn
        {...defaultProps}
        tasks={[{ ...task, assigneeId: "u1" }]}
        assigneeById={assigneeMap}
      />,
    );
    expect(screen.getByLabelText("Alice")).toBeInTheDocument();
  });

  it("applies the drag-handle cursor-grabbing style while a column drag is in progress", () => {
    render(<KanbanColumn {...defaultProps} isColumnDragging />);
    expect(screen.getByRole("button", { name: /drag to reorder column/i })).toHaveClass(
      "cursor-grabbing",
    );
  });

  it("falls back to null assignee when assigneeId isn't in the map", () => {
    render(
      <KanbanColumn
        {...defaultProps}
        tasks={[{ ...task, assigneeId: "ghost-id" }]}
        assigneeById={new Map()}
      />,
    );
    expect(screen.getByTestId(`task-card-${task.id}`)).toBeInTheDocument();
  });
});
