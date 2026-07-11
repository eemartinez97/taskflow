import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit"));

import { KanbanCard } from "@/components/kanban/kanban-card";
import { makeTask } from "@/tests/helpers";

describe("KanbanCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the task title", () => {
    render(<KanbanCard task={makeTask({ title: "Fix bug #42" })} />);
    expect(screen.getByText("Fix bug #42")).toBeInTheDocument();
  });

  it("has data-testid for task lookup", () => {
    const task = makeTask();
    render(<KanbanCard task={task} />);
    expect(screen.getByTestId(`task-card-${task.id}`)).toBeInTheDocument();
  });

  it("does NOT render a Badge when priority is NONE", () => {
    render(<KanbanCard task={makeTask({ priority: "NONE" })} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a priority Badge for HIGH priority", () => {
    render(<KanbanCard task={makeTask({ priority: "HIGH" })} />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders a priority Badge for URGENT priority", () => {
    render(<KanbanCard task={makeTask({ priority: "URGENT" })} />);
    expect(screen.getByText("URGENT")).toBeInTheDocument();
  });

  it("renders correctly with isOverlay=true", () => {
    render(<KanbanCard task={makeTask()} isOverlay />);
    expect(screen.getByTestId(`task-card-${makeTask().id}`)).toBeInTheDocument();
  });
});
