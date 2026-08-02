import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@taskflow/api/trpc";
import { TasksClient } from "@/app/(dashboard)/tasks/_components/tasks-client";
import { api } from "@/lib/trpc/client";
import { renderUI } from "../../helpers/render";
import { mockUseQuery } from "@/tests/support/trpc";

// -- Module mocks --

vi.mock("@/components/task/task-detail-panel", () => ({
  TaskDetailPanel: ({ task, onClose }: { task: { title: string }; onClose: () => void }) => (
    <div data-testid="task-detail-panel">
      <span>{task.title}</span>
      <button onClick={onClose}>Close panel</button>
    </div>
  ),
}));

// -- Fixtures --
type MyTask = inferRouterOutputs<AppRouter>["tasks"]["myTasks"][number];

function makeMyTask(id: string, title: string, overrides: Partial<MyTask> = {}): MyTask {
  return {
    id,
    title,
    description: null,
    priority: "MEDIUM",
    status: "TODO",
    columnId: "col-1",
    orgId: "org-1",
    projectId: "proj-1",
    assigneeId: null,
    position: 1000,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } as MyTask;
}

const TASK_A = makeMyTask("task-1", "Fix login bug", { description: "JWT expiry issue." });
const TASK_B = makeMyTask("task-2", "Add dark mode", { priority: "HIGH", status: "IN_PROGRESS" });

// -- Helpers --
function setupMyTasksQuery(tasks: MyTask[]): void {
  mockUseQuery(api.tasks.myTasks, tasks);
}

// -- Tests --
describe("TasksClient", () => {
  beforeEach(() => {
    setupMyTasksQuery([TASK_A, TASK_B]);
  });

  // -- Empty state --

  it("shows the empty-state message when there are no tasks", () => {
    setupMyTasksQuery([]);
    renderUI(<TasksClient initialTasks={[]} initialOpenTaskId={null} />);

    expect(screen.getByText(/no tasks assigned to you yet/i)).toBeInTheDocument();
  });

  it("does NOT render the task list when there are no tasks", () => {
    setupMyTasksQuery([]);
    renderUI(<TasksClient initialTasks={[]} initialOpenTaskId={null} />);

    expect(screen.queryByRole("button", { name: /open task/i })).not.toBeInTheDocument();
  });

  // -- Task list rendering --

  it("renders a row for each task with the correct aria-label", () => {
    renderUI(<TasksClient initialTasks={[TASK_A, TASK_B]} initialOpenTaskId={null} />);

    expect(screen.getByRole("button", { name: "Open task: Fix login bug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open task: Add dark mode" })).toBeInTheDocument();
  });

  it("renders the task title for each row", () => {
    renderUI(<TasksClient initialTasks={[TASK_A, TASK_B]} initialOpenTaskId={null} />);

    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.getByText("Add dark mode")).toBeInTheDocument();
  });

  it("renders the task description when present", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId={null} />);

    expect(screen.getByText("JWT expiry issue.")).toBeInTheDocument();
  });

  it("renders the priority badge for each task", () => {
    renderUI(<TasksClient initialTasks={[TASK_A, TASK_B]} initialOpenTaskId={null} />);

    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders the formatted status for each task", () => {
    renderUI(<TasksClient initialTasks={[TASK_B]} initialOpenTaskId={null} />);

    // formatTaskStatus replaces underscores with spaces
    expect(screen.getByText("IN PROGRESS")).toBeInTheDocument();
  });

  // -- Detail panel - open via click --

  it("opens TaskDetailPanel when a task row is clicked", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Open task: Fix login bug" }));

    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
    expect(
      screen.getByText("Fix login bug", { selector: "[data-testid='task-detail-panel'] span" }),
    ).toBeInTheDocument();
  });

  it("opens TaskDetailPanel when Enter is pressed on a task row", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId={null} />);

    const row = screen.getByRole("button", { name: "Open task: Fix login bug" });
    fireEvent.keyDown(row, { key: "Enter" });

    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
  });

  it("opens TaskDetailPanel when Space is pressed on a task row", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId={null} />);

    const row = screen.getByRole("button", { name: "Open task: Fix login bug" });
    fireEvent.keyDown(row, { key: " " });

    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
  });

  // -- Detail panel - open via initialOpenTaskId --

  it("opens TaskDetailPanel on mount when initialOpenTaskId matches a task", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId={TASK_A.id} />);

    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
  });

  it("does NOT open TaskDetailPanel when initialOpenTaskId is null", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId={null} />);

    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });

  it("does NOT open panel when initialOpenTaskId matches no task in the list", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId="nonexistent-id" />);

    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });

  // -- Detail panel - close --

  it("closes TaskDetailPanel when its onClose callback fires", () => {
    renderUI(<TasksClient initialTasks={[TASK_A]} initialOpenTaskId={TASK_A.id} />);
    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));

    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });
});
