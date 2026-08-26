import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TaskLabels } from "@/components/task/task-labels";

const labelA = {
  id: "l1",
  orgId: "org",
  name: "Bug",
  color: "#EF4444",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const labelB = {
  id: "l2",
  orgId: "org",
  name: "Feature",
  color: "#3B82F6",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("TaskLabels", () => {
  it("renders attached labels with a remove button each", () => {
    render(
      <TaskLabels
        orgLabels={[labelA, labelB]}
        taskLabelIds={[labelA.id]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove label bug/i })).toBeInTheDocument();
  });

  it("calls onRemove with the label id", async () => {
    const onRemove = vi.fn();
    render(
      <TaskLabels
        orgLabels={[labelA]}
        taskLabelIds={[labelA.id]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /remove label bug/i }));
    expect(onRemove).toHaveBeenCalledWith(labelA.id);
  });

  it("hides the add-label trigger when every org label is already attached", () => {
    render(
      <TaskLabels
        orgLabels={[labelA]}
        taskLabelIds={[labelA.id]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /add label/i })).not.toBeInTheDocument();
  });

  it("opens the picker and calls onAdd, keeping it open for multi-select", async () => {
    const onAdd = vi.fn();
    render(
      <TaskLabels
        orgLabels={[labelA, labelB]}
        taskLabelIds={[]}
        canEdit={true}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add label/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Bug" }));
    expect(onAdd).toHaveBeenCalledWith(labelA.id);
  });

  it("closes the picker on outside click", async () => {
    render(
      <div>
        <button>outside</button>
        <TaskLabels
          orgLabels={[labelA]}
          taskLabelIds={[]}
          canEdit={true}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
        />
      </div>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add label/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the picker on Escape", async () => {
    render(
      <TaskLabels
        orgLabels={[labelA]}
        taskLabelIds={[]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add label/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("auto-closes the picker once the last available label is attached", () => {
    const { rerender } = render(
      <TaskLabels
        orgLabels={[labelA]}
        taskLabelIds={[]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    rerender(
      <TaskLabels
        orgLabels={[labelA]}
        taskLabelIds={[labelA.id]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /add label/i })).not.toBeInTheDocument();
  });

  it("does not throw when available count changes while the picker is already closed", () => {
    const { rerender } = render(
      <TaskLabels
        orgLabels={[labelA, labelB]}
        taskLabelIds={[]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    rerender(
      <TaskLabels
        orgLabels={[labelA, labelB]}
        taskLabelIds={[labelA.id]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /add label/i })).toBeInTheDocument();
  });

  it("removes an attached label while others remain attached", async () => {
    const onRemove = vi.fn();
    render(
      <TaskLabels
        orgLabels={[labelA, labelB]}
        taskLabelIds={[labelA.id, labelB.id]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /remove label feature/i }));
    expect(onRemove).toHaveBeenCalledWith(labelB.id);
  });

  it("keeps the picker open on a non-Escape key press", async () => {
    render(
      <TaskLabels
        orgLabels={[labelA]}
        taskLabelIds={[]}
        canEdit={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add label/i }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("hides remove buttons and the add-label trigger when canEdit is false", () => {
    render(
      <TaskLabels
        orgLabels={[labelA, labelB]}
        taskLabelIds={[labelA.id]}
        canEdit={false}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove label bug/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add label/i })).not.toBeInTheDocument();
  });
});
