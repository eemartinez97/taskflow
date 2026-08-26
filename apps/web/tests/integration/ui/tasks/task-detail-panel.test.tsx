import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { Task } from "@taskflow/database";
import { useSession } from "next-auth/react";
import { TaskDetailPanel } from "@/components/task/task-detail-panel";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { registerDirtyCheck } from "@/lib/utils/navigation-guard";
import { mockSession } from "@/tests/mocks/next-auth";
import { renderUI } from "../../helpers/render";
import { mockMutationState, wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";

// -- Module mocks --

vi.mock("@/lib/utils/navigation-guard", () => ({
  registerDirtyCheck: vi.fn(() => () => undefined),
  hasUnsavedChanges: vi.fn(() => false),
}));

vi.mock("@/components/task/task-comments", () => ({
  TaskComments: () => <div data-testid="task-comments" />,
}));
vi.mock("@/components/task/task-labels", () => ({
  TaskLabels: () => <div data-testid="task-labels" />,
}));
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onClose,
  }: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirm delete</button>
        <button onClick={onClose}>Cancel delete</button>
      </div>
    ) : null,
}));

// -- Fixtures --
const MOCK_TASK: Task = {
  id: "task-uuid-1",
  title: "Fix login bug",
  description: "JWT expiry issue.",
  priority: "MEDIUM",
  status: "TODO",
  columnId: "col-1",
  assigneeId: null,
  creatorId: null,
  dueDate: null,
  position: 1000,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// -- Helpers --
const mockOnClose = vi.fn();
let updateMutation: ReturnType<typeof wireCapturableMutation>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;
let mockInvalidateUtils: ReturnType<typeof vi.fn>;

function buildProps(overrides: Partial<Parameters<typeof TaskDetailPanel>[0]> = {}) {
  return {
    task: MOCK_TASK,
    orgId: "org-1",
    projectId: "proj-1",
    canEdit: true,
    onClose: mockOnClose,
    ...overrides,
  };
}

function setupFullTaskQuery(task: Task = MOCK_TASK): void {
  mockUseQuery(api.tasks.get, task);
}

// -- Tests --
describe("TaskDetailPanel", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: vi.fn(),
    });

    setupFullTaskQuery();

    mockUseQuery(api.orgs.assigneeLookup, { members: [], formerAssignees: [] });
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.tasks.labels, []);

    mockInvalidateUtils = vi.fn();

    mockApiUtils({ tasks: { list: { invalidate: mockInvalidateUtils } } });

    updateMutation = wireCapturableMutation(api.tasks.update);

    deleteMutation = wireCapturableMutation(api.tasks.delete);

    vi.mocked(api.tasks.addLabel.useMutation).mockReturnValue({
      ...updateMutation.mockReturn,
    } as never);
    vi.mocked(api.tasks.removeLabel.useMutation).mockReturnValue({
      ...updateMutation.mockReturn,
    } as never);
  });

  // -- Rendering --

  it("renders the 'Task details' dialog heading", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    expect(screen.getByRole("dialog", { name: "Task details" })).toBeInTheDocument();
  });

  it("pre-fills the Title input with the task title", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    expect(screen.getByDisplayValue("Fix login bug")).toBeInTheDocument();
  });

  it("pre-fills the Description textarea with the task description", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    expect(screen.getByDisplayValue("JWT expiry issue.")).toBeInTheDocument();
  });

  it("renders the Delete task and Close panel buttons in the header", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Delete task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close panel" })).toBeInTheDocument();
  });

  it("renders the TaskComments and TaskLabels sub-components", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    expect(screen.getByTestId("task-comments")).toBeInTheDocument();
    expect(screen.getByTestId("task-labels")).toBeInTheDocument();
  });

  it("calls registerDirtyCheck on mount", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    expect(vi.mocked(registerDirtyCheck)).toHaveBeenCalledOnce();
  });

  // -- Close panel --

  it("calls onClose when the Close panel button is clicked", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const { container } = renderUI(<TaskDetailPanel {...buildProps()} />);

    const backdrop = container.querySelector('[aria-hidden="true"]');
    if (!backdrop) throw new Error("Backdrop not found");

    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  // -- Autosave on blur --

  it("calls updateMutation.mutate when the Title input is changed and blurred", async () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    const titleInput = screen.getByDisplayValue("Fix login bug");
    fireEvent.change(titleInput, { target: { value: "Fix login bug v2" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(updateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          projectId: "proj-1",
          taskId: MOCK_TASK.id,
          data: expect.objectContaining({ title: "Fix login bug v2" }) as unknown,
        }),
      );
    });
  });

  it("does NOT call updateMutation.mutate when blurring with unchanged values (no-op guard)", async () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    // Blur without changing anything - values match fullTask
    const titleInput = screen.getByDisplayValue("Fix login bug");
    fireEvent.blur(titleInput);

    // Wait a tick to ensure any async handleSubmit has resolved
    await new Promise((r) => setTimeout(r, 0));

    expect(updateMutation.mutate).not.toHaveBeenCalled();
  });

  it("calls updateMutation.mutate when Enter is pressed in the Title input with a changed value", async () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    const titleInput = screen.getByDisplayValue("Fix login bug");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });
    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(updateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: "Updated Title" }) as unknown,
        }),
      );
    });
  });

  it("calls updateMutation.mutate when the Priority select changes", async () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);

    const prioritySelect = screen.getByLabelText("Priority");
    fireEvent.change(prioritySelect, { target: { value: "HIGH" } });

    await waitFor(() => {
      expect(updateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ priority: "HIGH" }) as unknown }),
      );
    });
  });

  // -- Update success --

  it("shows a 'Task saved.' toast on update success", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);
    updateMutation.simulateSuccess(MOCK_TASK);

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Task saved.");
  });

  it("shows 'Saved' status text while mutation is successful", () => {
    mockMutationState(api.tasks.update, updateMutation, { isSuccess: true });
    renderUI(<TaskDetailPanel {...buildProps()} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shows 'Saving…' status text while mutation is pending", () => {
    mockMutationState(api.tasks.update, updateMutation, { isPending: true });
    renderUI(<TaskDetailPanel {...buildProps()} />);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  // -- Delete flow --

  it("opens ConfirmDialog when the Delete task button is clicked", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
  });

  it("calls deleteMutation.mutate with the correct ids when delete is confirmed", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: "proj-1",
      taskId: MOCK_TASK.id,
    });
  });

  it("closes ConfirmDialog without calling mutate when Cancel is clicked", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    expect(deleteMutation.mutate).not.toHaveBeenCalled();
  });

  it("calls onClose after a successful deletion", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    deleteMutation.simulateSuccess();

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("shows a 'Task deleted.' toast after a successful deletion", () => {
    renderUI(<TaskDetailPanel {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    deleteMutation.simulateSuccess();

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Task deleted.");
  });
});
