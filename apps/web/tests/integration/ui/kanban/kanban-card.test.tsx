import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { renderUI } from "../../helpers/render";
import { makeLabel } from "@/tests/support/factories";
import { makeTask } from "@/tests/support/factories";

// -- Module mocks --

vi.mock("@dnd-kit/sortable", async () => await import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/utilities", async () => await import("@/tests/mocks/dnd-kit-utilities"));
vi.mock("@/components/common/user-avatar", () => ({
  UserAvatar: ({ user }: { user: { name?: string | null } }) => (
    <span data-testid="user-avatar">{user.name ?? "?"}</span>
  ),
}));

// -- Tests --
describe("KanbanCard", () => {
  // -- Rendering --

  it("renders the task title", () => {
    renderUI(<KanbanCard task={makeTask()} />);

    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });

  it("renders the description when it is present", () => {
    renderUI(<KanbanCard task={makeTask({ description: "Investigate JWT expiry." })} />);

    expect(screen.getByText("Investigate JWT expiry.")).toBeInTheDocument();
  });

  it("does NOT render a description element when description is null", () => {
    renderUI(<KanbanCard task={makeTask({ description: null })} />);

    expect(screen.queryByText(/investigate/i)).not.toBeInTheDocument();
  });

  it("renders the drag-handle button with the correct aria-label", () => {
    renderUI(<KanbanCard task={makeTask()} />);

    expect(screen.getByRole("button", { name: "Move task: Fix login bug" })).toBeInTheDocument();
  });

  it("has role='button' and the correct aria-label on the card wrapper", () => {
    renderUI(<KanbanCard task={makeTask()} />);

    expect(screen.getByRole("button", { name: "Open task: Fix login bug" })).toBeInTheDocument();
  });

  // -- Priority --

  it("renders a priority badge when priority is not NONE", () => {
    renderUI(<KanbanCard task={makeTask({ priority: "HIGH" })} />);

    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("does NOT render a priority badge when priority is NONE", () => {
    renderUI(<KanbanCard task={makeTask({ priority: "NONE" })} />);

    expect(screen.queryByText("NONE")).not.toBeInTheDocument();
  });

  // -- Labels --

  it("renders a chip for each label", () => {
    const labels = [makeLabel("l1", "Bug"), makeLabel("l2", "Urgent")];
    renderUI(<KanbanCard task={makeTask()} labels={labels} />);

    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("does NOT render any label chips when labels array is empty", () => {
    renderUI(<KanbanCard task={makeTask()} labels={[]} />);

    // No colored pill elements should be in the card
    expect(screen.queryByText("Bug")).not.toBeInTheDocument();
  });

  // -- Assignee --

  it("renders UserAvatar when an assignee is provided", () => {
    const assignee = { name: "Alice", email: "alice@test.com" };
    renderUI(<KanbanCard task={makeTask()} assignee={assignee} />);

    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
    expect(screen.getByTestId("user-avatar")).toHaveTextContent("Alice");
  });

  it("does NOT render UserAvatar when assignee is null", () => {
    renderUI(<KanbanCard task={makeTask()} assignee={null} />);

    expect(screen.queryByTestId("user-avatar")).not.toBeInTheDocument();
  });

  // -- Click / keyboard --

  it("calls onClick when the card wrapper is clicked", () => {
    const mockOnClick = vi.fn();
    renderUI(<KanbanCard task={makeTask()} onClick={mockOnClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Open task: Fix login bug" }));

    expect(mockOnClick).toHaveBeenCalledOnce();
  });

  it("calls onClick when Enter is pressed on the card wrapper", () => {
    const mockOnClick = vi.fn();
    renderUI(<KanbanCard task={makeTask()} onClick={mockOnClick} />);

    const card = screen.getByRole("button", { name: "Open task: Fix login bug" });
    fireEvent.keyDown(card, { key: "Enter", target: card });

    expect(mockOnClick).toHaveBeenCalledOnce();
  });

  it("calls onClick when Space is pressed on the card wrapper", () => {
    const mockOnClick = vi.fn();
    renderUI(<KanbanCard task={makeTask()} onClick={mockOnClick} />);

    const card = screen.getByRole("button", { name: "Open task: Fix login bug" });
    fireEvent.keyDown(card, { key: " ", target: card });

    expect(mockOnClick).toHaveBeenCalledOnce();
  });
});
