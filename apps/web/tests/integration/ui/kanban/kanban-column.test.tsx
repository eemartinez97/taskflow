import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { renderUI } from "../../helpers/render";
import { makeColumn, makeTask } from "@/tests/support/factories";

// -- Module mocks --
vi.mock("@taskflow/ui", async () => await import("@/tests/mocks/taskflow-ui"));
vi.mock("@dnd-kit/sortable", async () => await import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/utilities", async () => await import("@/tests/mocks/dnd-kit-utilities"));

// Stub KanbanCard so this test stays focused on column-level behavior
vi.mock("@/components/kanban/kanban-card", () => ({
  KanbanCard: ({
    task,
    onClick,
  }: {
    task: { id: string; title: string };
    onClick?: () => void;
  }) => (
    <div data-testid={`card-${task.id}`} role="button" onClick={onClick}>
      {task.title}
    </div>
  ),
}));

// Stub AddTaskButton to a minimal clickable version
vi.mock("@/components/kanban/add-task-button", () => ({
  AddTaskButton: ({ onAdd, loading }: { onAdd: (title: string) => void; loading?: boolean }) => (
    <button
      data-testid="add-task-btn"
      disabled={loading}
      onClick={() => {
        onAdd("New task from button");
      }}
    >
      Add task
    </button>
  ),
}));

vi.mock("@/components/common/dropdown-menu", () => ({
  DropdownMenu: ({
    items,
    triggerLabel,
  }: {
    items: { label: string; onClick: () => void }[];
    triggerLabel?: string;
  }) => (
    <div data-testid="column-menu">
      {items.map((item) => (
        <button
          key={item.label}
          aria-label={`${triggerLabel ?? ""}: ${item.label}`}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

// -- Helpers --
const TASK_A = makeTask({ id: "task-1", title: "Fix login bug" });
const TASK_B = makeTask({ id: "task-2", title: "Add dark mode" });
const COLUMN = makeColumn({ id: "col-1" });

function buildProps(
  overrides: Partial<Parameters<typeof KanbanColumn>[0]> = {},
): Parameters<typeof KanbanColumn>[0] {
  return {
    column: COLUMN,
    tasks: [TASK_A, TASK_B],
    isOver: false,
    isColumnDragging: false,
    onAddTask: vi.fn(),
    onTaskClick: vi.fn(),
    onRenameColumn: vi.fn(),
    onDeleteColumn: vi.fn(),
    assigneeById: new Map(),
    addingTaskId: null,
    labelsByTask: {},
    ...overrides,
  };
}

// -- Tests --
describe("KanbanColumn", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // -- Rendering --

  it("renders the column name in the header", () => {
    renderUI(<KanbanColumn {...buildProps()} />);

    expect(screen.getByRole("textbox", { name: /column name \(to do\)/i })).toBeInTheDocument();
  });

  it("renders the task count badge with the correct number", () => {
    renderUI(<KanbanColumn {...buildProps()} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders a card for each task", () => {
    renderUI(<KanbanColumn {...buildProps()} />);

    expect(screen.getByTestId("card-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-task-2")).toBeInTheDocument();
  });

  it("renders the column with data-testid matching the column id", () => {
    renderUI(<KanbanColumn {...buildProps()} />);

    expect(screen.getByTestId("column-col-1")).toBeInTheDocument();
  });

  it("renders the drag-handle button with the correct aria-label", () => {
    renderUI(<KanbanColumn {...buildProps()} />);

    expect(
      screen.getByRole("button", { name: /drag to reorder column: to do/i }),
    ).toBeInTheDocument();
  });

  // -- isOver state --

  it("renders without error when isOver is false", () => {
    renderUI(<KanbanColumn {...buildProps({ isOver: false })} />);

    expect(screen.getByTestId("column-col-1")).toBeInTheDocument();
  });

  it("renders without error when isOver is true", () => {
    renderUI(<KanbanColumn {...buildProps({ isOver: true })} />);

    expect(screen.getByTestId("column-col-1")).toBeInTheDocument();
  });

  // -- Rename column --

  it("calls onRenameColumn with the new name when the inline edit blurs", () => {
    const mockRename = vi.fn();
    renderUI(<KanbanColumn {...buildProps({ onRenameColumn: mockRename })} />);

    const nameInput = screen.getByRole("textbox", { name: /column name/i });
    fireEvent.blur(nameInput, { target: { value: "In Progress" } });

    expect(mockRename).toHaveBeenCalledWith(COLUMN.id, "In Progress");
  });

  // -- Delete column --

  it("calls onDeleteColumn with the column when the delete menu item is clicked", () => {
    const mockDelete = vi.fn();
    renderUI(<KanbanColumn {...buildProps({ onDeleteColumn: mockDelete })} />);

    fireEvent.click(screen.getByRole("button", { name: /delete column/i }));

    expect(mockDelete).toHaveBeenCalledWith(COLUMN);
  });

  // -- Task interaction --

  it("calls onTaskClick with the task when a card is clicked", () => {
    const mockTaskClick = vi.fn();
    renderUI(<KanbanColumn {...buildProps({ onTaskClick: mockTaskClick })} />);

    fireEvent.click(screen.getByTestId("card-task-1"));

    expect(mockTaskClick).toHaveBeenCalledWith(TASK_A);
  });

  // -- Add task --

  it("calls onAddTask with the columnId and title when AddTaskButton fires", () => {
    const mockAddTask = vi.fn();
    renderUI(<KanbanColumn {...buildProps({ onAddTask: mockAddTask })} />);

    fireEvent.click(screen.getByTestId("add-task-btn"));

    expect(mockAddTask).toHaveBeenCalledWith(COLUMN.id, "New task from button");
  });

  it("renders AddTaskButton in loading state when addingTaskId matches this column", () => {
    renderUI(<KanbanColumn {...buildProps({ addingTaskId: COLUMN.id })} />);

    expect(screen.getByTestId("add-task-btn")).toBeDisabled();
  });

  it("renders AddTaskButton NOT in loading state when addingTaskId is a different column", () => {
    renderUI(<KanbanColumn {...buildProps({ addingTaskId: "other-col" })} />);

    expect(screen.getByTestId("add-task-btn")).not.toBeDisabled();
  });

  // -- Empty state --

  it("renders zero task count and no cards when tasks array is empty", () => {
    renderUI(<KanbanColumn {...buildProps({ tasks: [] })} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByTestId(/^card-/)).not.toBeInTheDocument();
  });
});
