import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { TaskLabels } from "@/components/task/task-labels";
import { renderUI } from "../../helpers/render";
import { makeLabel } from "@/tests/support/factories";

// -- Fixtures --

const LABEL_BUG = makeLabel("l-bug", "Bug", { color: "#EF4444" });
const LABEL_URGENT = makeLabel("l-urgent", "Urgent", { color: "#F97316" });
const LABEL_FEATURE = makeLabel("l-feature", "Feature", { color: "#22C55E" });

// -- Helpers --
function buildProps(
  overrides: Partial<Parameters<typeof TaskLabels>[0]> = {},
): Parameters<typeof TaskLabels>[0] {
  return {
    orgLabels: [LABEL_BUG, LABEL_URGENT, LABEL_FEATURE],
    taskLabelIds: [],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
}

// -- Tests --
describe("TaskLabels", () => {
  // -- Rendering --

  it("renders the Labels section heading", () => {
    renderUI(<TaskLabels {...buildProps()} />);

    expect(screen.getByText("Labels")).toBeInTheDocument();
  });

  it("renders attached label chips for each taskLabelId", () => {
    renderUI(<TaskLabels {...buildProps({ taskLabelIds: [LABEL_BUG.id, LABEL_URGENT.id] })} />);

    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("does NOT render a chip for labels not in taskLabelIds", () => {
    renderUI(<TaskLabels {...buildProps({ taskLabelIds: [LABEL_BUG.id] })} />);

    expect(screen.queryByText("Urgent")).not.toBeInTheDocument();
    expect(screen.queryByText("Feature")).not.toBeInTheDocument();
  });

  it("renders a Remove button for each attached label", () => {
    renderUI(<TaskLabels {...buildProps({ taskLabelIds: [LABEL_BUG.id, LABEL_URGENT.id] })} />);

    expect(screen.getByRole("button", { name: "Remove label Bug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove label Urgent" })).toBeInTheDocument();
  });

  // -- Remove label --

  it("calls onRemove with the label id when a Remove button is clicked", () => {
    const mockOnRemove = vi.fn();
    renderUI(
      <TaskLabels {...buildProps({ taskLabelIds: [LABEL_BUG.id], onRemove: mockOnRemove })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove label Bug" }));

    expect(mockOnRemove).toHaveBeenCalledWith(LABEL_BUG.id);
  });

  // -- Add label picker --

  it("renders the '+' Add label button when there are available labels", () => {
    renderUI(<TaskLabels {...buildProps({ taskLabelIds: [] })} />);

    expect(screen.getByRole("button", { name: "Add label" })).toBeInTheDocument();
  });

  it("does NOT render the '+' button when all labels are already attached", () => {
    renderUI(
      <TaskLabels
        {...buildProps({
          taskLabelIds: [LABEL_BUG.id, LABEL_URGENT.id, LABEL_FEATURE.id],
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: "Add label" })).not.toBeInTheDocument();
  });

  it("does NOT render the '+' button when orgLabels is empty", () => {
    renderUI(<TaskLabels {...buildProps({ orgLabels: [] })} />);

    expect(screen.queryByRole("button", { name: "Add label" })).not.toBeInTheDocument();
  });

  it("opens the label picker when the '+' button is clicked", () => {
    renderUI(<TaskLabels {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("shows only available labels (not already attached) in the picker", () => {
    renderUI(<TaskLabels {...buildProps({ taskLabelIds: [LABEL_BUG.id] })} />);
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    expect(screen.getByRole("menuitem", { name: "Urgent" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Feature" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Bug" })).not.toBeInTheDocument();
  });

  it("calls onAdd with the label id when a label is selected in the picker", () => {
    const mockOnAdd = vi.fn();
    renderUI(<TaskLabels {...buildProps({ onAdd: mockOnAdd })} />);

    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Bug" }));

    expect(mockOnAdd).toHaveBeenCalledWith(LABEL_BUG.id);
  });

  it("keeps the picker open after adding a label (allows multiple additions)", () => {
    const mockOnAdd = vi.fn();
    renderUI(<TaskLabels {...buildProps({ onAdd: mockOnAdd })} />);

    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Bug" }));

    // Picker remains open
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(mockOnAdd).toHaveBeenCalledOnce();
  });

  // -- Picker close behaviors --

  it("closes the picker when Escape is pressed", () => {
    renderUI(<TaskLabels {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the picker when clicking outside the picker container", () => {
    renderUI(<TaskLabels {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does NOT close the picker when clicking inside it", () => {
    renderUI(<TaskLabels {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));

    fireEvent.mouseDown(screen.getByRole("menu"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("auto-closes the picker when the last available label is attached", () => {
    // Start with 1 available label (Bug)
    const { rerender } = renderUI(
      <TaskLabels
        {...buildProps({
          orgLabels: [LABEL_BUG],
          taskLabelIds: [],
        })}
      />,
    );

    // Open the picker
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Parent confirms the label is now attached -> available becomes empty
    rerender(
      <TaskLabels
        orgLabels={[LABEL_BUG]}
        taskLabelIds={[LABEL_BUG.id]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
