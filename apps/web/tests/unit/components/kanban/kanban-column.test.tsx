import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities.js"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit.js"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui.js"));
vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit.js"));

import { makeColumn, makeTask, VALID_COL_A_ID, VALID_TASK_1_ID } from "@/tests/helpers";
import { KanbanColumn } from "@/components/kanban/kanban-column";

const col = makeColumn();
const task = makeTask({ id: VALID_TASK_1_ID, columnId: VALID_COL_A_ID, title: "Fix bug" });

describe("KanbanColumn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the column name", () => {
    render(<KanbanColumn column={col} tasks={[]} isOver={false} />);
    expect(screen.getByText("To Do")).toBeInTheDocument();
  });

  it("has data-testid for column lookup", () => {
    render(<KanbanColumn column={col} tasks={[]} isOver={false} />);
    expect(screen.getByTestId(`column-${col.id}`)).toBeInTheDocument();
  });

  it("renders each task card", () => {
    render(<KanbanColumn column={col} tasks={[task]} isOver={false} />);
    expect(screen.getByText(task.title)).toBeInTheDocument();
  });

  it("shows task count badge", () => {
    render(<KanbanColumn column={col} tasks={[task]} isOver={false} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows 0 count when empty", () => {
    render(<KanbanColumn column={col} tasks={[]} isOver={false} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("applies highlight ring when isOver=true", () => {
    const { container } = render(<KanbanColumn column={col} tasks={[]} isOver />);
    // The droppable div receives the ring class when isOver is true
    expect(container.querySelector(".ring-1")).toBeInTheDocument();
  });

  it("does not apply highlight ring when isOver=false", () => {
    const { container } = render(<KanbanColumn column={col} tasks={[]} isOver={false} />);
    expect(container.querySelector(".ring-1")).not.toBeInTheDocument();
  });
});
