import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities"));

import { KanbanCard } from "@/components/kanban/kanban-card";
import { makeTask } from "@/tests/support/factories";

const task = makeTask({ title: "Fix bug", description: "Details here", priority: "HIGH" });
const label = {
  id: "l1",
  orgId: "org",
  name: "Bug",
  color: "#EF4444",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("KanbanCard", () => {
  it("renders the title and description", () => {
    render(<KanbanCard task={task} />);
    expect(screen.getByText("Fix bug")).toBeInTheDocument();
    expect(screen.getByText("Details here")).toBeInTheDocument();
  });

  it("renders attached labels", () => {
    render(<KanbanCard task={task} labels={[label]} />);
    expect(screen.getByText("Bug")).toBeInTheDocument();
  });

  it("renders the priority badge when priority !== NONE", () => {
    render(<KanbanCard task={task} />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("omits the priority badge for NONE priority with no assignee", () => {
    render(<KanbanCard task={makeTask({ priority: "NONE" })} />);
    expect(screen.queryByText("NONE")).not.toBeInTheDocument();
  });

  it("renders the assignee avatar when provided", () => {
    render(<KanbanCard task={task} assignee={{ name: "Alice", email: "a@x.com" }} />);
    expect(screen.getByLabelText("Alice")).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", async () => {
    const onClick = vi.fn();
    render(<KanbanCard task={task} onClick={onClick} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /open task: fix bug/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onClick on Enter/Space when the card itself is focused", async () => {
    const onClick = vi.fn();
    render(<KanbanCard task={task} onClick={onClick} />);
    screen.getByRole("button", { name: /open task: fix bug/i }).focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not trigger onClick via keydown bubbling from the drag handle", async () => {
    const onClick = vi.fn();
    render(<KanbanCard task={task} onClick={onClick} />);
    const handle = screen.getByRole("button", { name: /move task: fix bug/i });
    handle.focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stops propagation when clicking the drag handle (does not trigger card onClick)", async () => {
    const onClick = vi.fn();
    render(<KanbanCard task={task} onClick={onClick} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /move task: fix bug/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies overlay styling when isOverlay is true", () => {
    render(<KanbanCard task={task} isOverlay />);
    expect(screen.getByTestId(`task-card-${task.id}`)).toHaveClass("rotate-1");
  });

  it("shows the priority badge alongside the assignee when both are present", () => {
    render(
      <KanbanCard
        task={{ ...task, priority: "HIGH" }}
        assignee={{ name: "Alice", email: "a@x.com" }}
      />,
    );
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByLabelText("Alice")).toBeInTheDocument();
  });

  it("renders an empty placeholder slot when priority is NONE but an assignee exists", () => {
    render(
      <KanbanCard
        task={{ ...task, priority: "NONE" }}
        assignee={{ name: "Alice", email: "a@x.com" }}
      />,
    );
    expect(screen.queryByText("NONE")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alice")).toBeInTheDocument();
  });

  it("applies dragging styles when isDragging is true", async () => {
    const { useSortable } = await import("@dnd-kit/sortable");
    vi.mocked(useSortable).mockReturnValueOnce({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: true,
    } as never);
    render(<KanbanCard task={task} />);
    expect(screen.getByTestId(`task-card-${task.id}`)).toHaveClass("opacity-40");
  });

  it("ignores keydown on the card itself for keys other than Enter/Space", async () => {
    const onClick = vi.fn();
    render(<KanbanCard task={task} onClick={onClick} />);
    screen.getByRole("button", { name: /open task: fix bug/i }).focus();
    await userEvent.setup().keyboard("a");
    expect(onClick).not.toHaveBeenCalled();
  });
});
