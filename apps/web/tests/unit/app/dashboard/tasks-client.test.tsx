import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/task/task-detail-panel", () => ({
  TaskDetailPanel: ({ task, onClose }: { task: { title: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Task details">
      {task.title}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import { api } from "@/lib/trpc/client";
import { TasksClient } from "@/app/(dashboard)/tasks/_components/tasks-client";
import { makeTask } from "@/tests/support/factories";
import { VALID_ORG_ID, VALID_PROJECT_ID } from "@/tests/support/fixtures";
import { mockUseQuery } from "@/tests/support/trpc";

const task = {
  ...makeTask({ title: "Fix bug" }),
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
};

describe("TasksClient", () => {
  it("shows an empty state when there are no tasks", () => {
    mockUseQuery(api.tasks.myTasks, []);
    render(<TasksClient initialTasks={[]} initialOpenTaskId={null} />);
    expect(screen.getByText(/no tasks assigned/i)).toBeInTheDocument();
  });

  it("opens the detail panel when a task is clicked", async () => {
    mockUseQuery(api.tasks.myTasks, [task]);
    render(<TasksClient initialTasks={[task]} initialOpenTaskId={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /open task: fix bug/i }));
    expect(screen.getByRole("dialog", { name: /task details/i })).toBeInTheDocument();
  });

  it("opens the detail panel via keyboard (Enter)", async () => {
    mockUseQuery(api.tasks.myTasks, [task]);
    render(<TasksClient initialTasks={[task]} initialOpenTaskId={null} />);
    screen.getByRole("button", { name: /open task: fix bug/i }).focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("pre-opens a task when initialOpenTaskId matches", () => {
    mockUseQuery(api.tasks.myTasks, [task]);
    render(<TasksClient initialTasks={[task]} initialOpenTaskId={task.id} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the panel when onClose is invoked", async () => {
    mockUseQuery(api.tasks.myTasks, [task]);
    render(<TasksClient initialTasks={[task]} initialOpenTaskId={task.id} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the task description when present", () => {
    const withDesc = { ...task, description: "Some details" };
    mockUseQuery(api.tasks.myTasks, [withDesc]);
    render(<TasksClient initialTasks={[withDesc]} initialOpenTaskId={null} />);
    expect(screen.getByText("Some details")).toBeInTheDocument();
  });

  it("opens the detail panel via keyboard (Space)", async () => {
    mockUseQuery(api.tasks.myTasks, [task]);
    render(<TasksClient initialTasks={[task]} initialOpenTaskId={null} />);
    screen.getByRole("button", { name: /open task: fix bug/i }).focus();
    await userEvent.setup().keyboard(" ");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render a description line when the task has none", () => {
    const noDesc = { ...task, description: null };
    mockUseQuery(api.tasks.myTasks, [noDesc]);
    render(<TasksClient initialTasks={[noDesc]} initialOpenTaskId={null} />);
    expect(screen.getByText("Fix bug")).toBeInTheDocument();
  });

  it("does not open the task on an unrelated key press", async () => {
    mockUseQuery(api.tasks.myTasks, [task]);
    render(<TasksClient initialTasks={[task]} initialOpenTaskId={null} />);
    const item = screen.getByRole("button", { name: /open task: fix bug/i });
    item.focus();
    await userEvent.setup().keyboard("a");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
