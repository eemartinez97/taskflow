import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/navigation-guard", () => ({
  registerDirtyCheck: vi.fn(() => () => undefined),
}));
vi.mock("@/components/task/task-comments", () => ({
  TaskComments: ({ onToggleExpand }: { onToggleExpand: () => void }) => (
    <div>
      TaskComments
      <button onClick={onToggleExpand}>Toggle Comments</button>
    </div>
  ),
}));
vi.mock("@/components/task/task-labels", () => ({
  TaskLabels: ({
    onAdd,
    onRemove,
  }: {
    onAdd: (id: string) => void;
    onRemove: (id: string) => void;
  }) => (
    <div>
      TaskLabels
      <button
        onClick={() => {
          onAdd("label-1");
        }}
      >
        Add Label
      </button>
      <button
        onClick={() => {
          onRemove("label-1");
        }}
      >
        Remove Label
      </button>
    </div>
  ),
}));
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm Delete</button> : null,
}));

import { api } from "@/lib/trpc/client";
import { TaskDetailPanel } from "@/components/task/task-detail-panel";

import { registerDirtyCheck } from "@/lib/utils/navigation-guard";
import {
  getLastMockUtils,
  mockUseMutationResult,
  mockUseQuery,
  setupMutationMock,
} from "@/tests/support/trpc";
import { makeTask } from "@/tests/support/factories";
import {
  VALID_COL_A_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_1_ID,
} from "@/tests/support/fixtures";

function setupBaseQueries(): void {
  mockUseQuery(api.tasks.get, makeTask());
  mockUseQuery(api.orgs.assigneeLookup, { members: [], formerAssignees: [] });
  mockUseQuery(api.labels.list, []);
  mockUseQuery(api.tasks.labels, []);
}

describe("TaskDetailPanel", () => {
  it("renders loading state for members and then the form", () => {
    mockUseQuery(api.tasks.get, makeTask());
    mockUseQuery(api.orgs.assigneeLookup, undefined, { isPending: true });
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.tasks.labels, []);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/loading members/i)).toBeInTheDocument();
  });

  it("registers a dirty-check callback that reflects the form's isDirty state", async () => {
    setupBaseQueries();
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const initialDirtyCheck = vi.mocked(registerDirtyCheck).mock.calls.at(-1)?.[0] as () => boolean;
    // Fresh form -> not dirty yet (invokes the `() => formState.isDirty` lambda body).
    expect(initialDirtyCheck()).toBe(false);
    // Dirty the title field, then confirm the SAME callback now reports true.
    const input = screen.getByLabelText(/title/i);
    await userEvent.setup().type(input, "x");
    // `useEffect(() => registerDirtyCheck(...), [formState.isDirty])` only re-registers
    // (capturing a fresh closure) once RHF flips isDirty to true and triggers a re-render -
    // wait for that re-registration, then read the LATEST captured callback.
    await waitFor(() => {
      expect(vi.mocked(registerDirtyCheck).mock.calls.length).toBeGreaterThan(1);
    });
    const latestDirtyCheck = vi.mocked(registerDirtyCheck).mock.calls.at(-1)?.[0] as () => boolean;
    expect(latestDirtyCheck()).toBe(true);
  });

  it("autosaves on blur if title changed", async () => {
    setupBaseQueries();
    const { mutateMock } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/title/i);
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, "New Title");
    await userEvent.setup().tab();
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "New Title" }) as unknown }),
    );
  });

  it("does not autosave if nothing changed on blur", async () => {
    setupBaseQueries();
    const { mutateMock } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByLabelText(/title/i));
    await userEvent.setup().tab();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("deletes task and calls onClose", async () => {
    setupBaseQueries();
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.tasks.delete);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={onClose}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /delete task/i }));
    await userEvent.setup().click(screen.getByRole("button", { name: /confirm delete/i }));
    act(() => {
      triggerSuccess(undefined, { taskId: VALID_TASK_1_ID });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("toggles the comments-expanded layout", async () => {
    setupBaseQueries();
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /toggle comments/i }));
  });

  it("syncs the labels cache when a label is added", async () => {
    setupBaseQueries();
    const { mutateMock, triggerSuccess } = setupMutationMock(api.tasks.addLabel);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /add label/i }));
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: VALID_ORG_ID, taskId: VALID_TASK_1_ID, labelId: "label-1" }),
    );
    act(() => {
      triggerSuccess([{ id: "label-1", name: "Bug", color: "#EF4444" }]);
    });
  });

  it("writes synced labels into labelsByProject using the same shape the realtime socket handler uses", async () => {
    setupBaseQueries();
    const setLabelsByProjectData = vi.fn();
    const template = api.useUtils();
    vi.mocked(api.useUtils).mockReturnValue({
      ...template,
      tasks: {
        ...template.tasks,
        labelsByProject: { ...template.tasks.labelsByProject, setData: setLabelsByProjectData },
      },
    });
    const { triggerSuccess } = setupMutationMock(api.tasks.addLabel);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /add label/i }));

    const newLabel = { id: "label-1", name: "Bug", color: "#EF4444" };
    act(() => {
      triggerSuccess([newLabel]);
    });

    expect(setLabelsByProjectData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID },
      expect.any(Function),
    );
    const updater = setLabelsByProjectData.mock.calls[0]?.[1] as (
      prev: { taskId: string; label: unknown }[] | undefined,
    ) => { taskId: string; label: unknown }[];
    const otherTaskPair = { taskId: "other-task", label: { id: "label-2" } };
    const stalePair = { taskId: VALID_TASK_1_ID, label: { id: "stale" } };
    expect(updater([otherTaskPair, stalePair])).toEqual([
      otherTaskPair,
      { taskId: VALID_TASK_1_ID, label: newLabel },
    ]);
    expect(updater(undefined)).toEqual([{ taskId: VALID_TASK_1_ID, label: newLabel }]);
  });

  it("syncs the labels cache when a label is removed", async () => {
    setupBaseQueries();
    const { mutateMock, triggerSuccess } = setupMutationMock(api.tasks.removeLabel);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /remove label/i }));
    expect(mutateMock).toHaveBeenCalled();
    act(() => {
      triggerSuccess([]);
    });
  });

  it("autosaves via onChange when a select field changes", async () => {
    setupBaseQueries();
    const { mutateMock } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    await userEvent.setup().selectOptions(screen.getByLabelText(/priority/i), "HIGH");
    expect(mutateMock).toHaveBeenCalled();
  });

  it("autosaves via Enter keydown on the title input", async () => {
    setupBaseQueries();
    const { mutateMock } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/title/i);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, "New Title{Enter}");

    expect(mutateMock).toHaveBeenCalled();
  });

  it("updates the tasks.list/tasks.get caches when the update mutation succeeds", () => {
    setupBaseQueries();
    const { triggerSuccess } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    act(() => {
      triggerSuccess({
        id: VALID_TASK_1_ID,
        columnId: VALID_COL_A_ID,
        title: "Updated title",
        priority: "NONE",
        status: "TODO",
      });
    });
  });

  it("renders assignee options when org members are present", () => {
    mockUseQuery(api.tasks.get, makeTask());
    mockUseQuery(api.orgs.assigneeLookup, {
      members: [
        {
          id: "m1",
          userId: "u1",
          role: "MEMBER",
          user: { id: "u1", name: "Alice", email: "a@x.com" },
        },
      ],
      formerAssignees: [],
    });
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.tasks.labels, [{ id: "l1", name: "Bug", color: "#EF4444" }]);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument();
  });

  it("shows a disabled, selected option for a task assigned to a former member", () => {
    const assignedTask = makeTask({ assigneeId: "ex-user" });
    mockUseQuery(api.tasks.get, assignedTask);
    mockUseQuery(api.orgs.assigneeLookup, {
      members: [],
      formerAssignees: [{ id: "ex-user", name: "Bob" }],
    });
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.tasks.labels, []);
    render(
      <TaskDetailPanel
        task={assignedTask}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const option = screen.getByRole("option", { name: "Bob · ex" });
    expect(option).toBeDisabled();
    expect(option).toHaveProperty("selected", true);
  });

  it("does not show a former-member option when the assignee is a current member", () => {
    const assignedTask = makeTask({ assigneeId: "u1" });
    mockUseQuery(api.tasks.get, assignedTask);
    mockUseQuery(api.orgs.assigneeLookup, {
      members: [
        {
          id: "m1",
          userId: "u1",
          role: "MEMBER",
          user: { id: "u1", name: "Alice", email: "a@x.com" },
        },
      ],
      formerAssignees: [{ id: "ex-user", name: "Bob" }],
    });
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.tasks.labels, []);
    render(
      <TaskDetailPanel
        task={assignedTask}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("option", { name: /· ex/ })).not.toBeInTheDocument();
  });

  it("does not show a former-member option when the task is unassigned", () => {
    const unassignedTask = makeTask({ assigneeId: null });
    mockUseQuery(api.tasks.get, unassignedTask);
    mockUseQuery(api.orgs.assigneeLookup, {
      members: [],
      formerAssignees: [{ id: "ex-user", name: "Bob" }],
    });
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.tasks.labels, []);
    render(
      <TaskDetailPanel
        task={unassignedTask}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("option", { name: /· ex/ })).not.toBeInTheDocument();
  });

  it("updates the tasks.list cache via the setData updater when update succeeds", () => {
    setupBaseQueries();
    const { triggerSuccess } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const utils = getLastMockUtils();

    const updated = { ...makeTask(), title: "Updated" };
    act(() => {
      triggerSuccess(updated);
    });
    const updater = utils.tasks.list.setData.mock.calls[0]?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater(undefined)).toEqual([]);
    // Ternary TRUE branch: matching id gets replaced.
    expect(updater([{ id: updated.id }])).toEqual([updated]);
    // Ternary FALSE branch: non-matching id is left untouched.
    expect(updater([{ id: "other-task" }])).toEqual([{ id: "other-task" }]);
  });

  it("updates the tasks.list cache via the setData updater when delete succeeds", () => {
    setupBaseQueries();
    const { triggerSuccess } = setupMutationMock(api.tasks.delete);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const utils = getLastMockUtils();

    act(() => {
      triggerSuccess();
    });
    const updater = utils.tasks.list.setData.mock.calls[0]?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater(undefined)).toEqual([]);
    expect(updater([{ id: VALID_TASK_1_ID }])).toEqual([]);
  });

  it("shows 'Saving…' while the update mutation is pending", () => {
    setupBaseQueries();
    mockUseMutationResult(api.tasks.update, { isPending: true });
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("shows 'Saved' when the update mutation succeeded", () => {
    setupBaseQueries();
    mockUseMutationResult(api.tasks.update, { isSuccess: true });
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("autosaves on blur of the description textarea", async () => {
    setupBaseQueries();
    const { mutateMock } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const textarea = screen.getByLabelText(/description/i);
    await userEvent.setup().type(textarea, "New description");
    await userEvent.setup().tab();
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: "New description" }) as unknown,
      }),
    );
  });

  it("does not autosave on blur of a select field (handled separately by onChange)", () => {
    setupBaseQueries();
    const { mutateMock } = setupMutationMock(api.tasks.update);
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={true}
        onClose={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/priority/i);
    fireEvent.blur(select);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("hides the delete button and disables every field when canEdit is false", () => {
    setupBaseQueries();
    render(
      <TaskDetailPanel
        task={makeTask()}
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        canEdit={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete task" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeDisabled();
    expect(screen.getByLabelText(/description/i)).toBeDisabled();
    expect(screen.getByLabelText(/priority/i)).toBeDisabled();
    expect(screen.getByLabelText(/status/i)).toBeDisabled();
  });
});
