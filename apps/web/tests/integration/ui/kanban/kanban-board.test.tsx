import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { Column, Task } from "@taskflow/database";
import type { SocketPresenceUser } from "@taskflow/shared";
import { useSession } from "next-auth/react";
import { KanbanBoard, boardCollisionDetection } from "@/components/kanban/kanban-board";
import { closestCenter } from "@dnd-kit/core";
import { api } from "@/lib/trpc/client";
import type { TasksMap } from "@/lib/board/tasks-map";
import { mockSession } from "@/tests/mocks/next-auth";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { makeColumn, makeLabel, makeTask } from "@/tests/support/factories";

// -- Module mocks --

vi.mock("@dnd-kit/core", async () => await import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/sortable", async () => await import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/utilities", async () => await import("@/tests/mocks/dnd-kit-utilities"));

vi.mock("@/lib/socket/socket-context", () => ({
  useSocketRef: vi.fn(() => ({ current: null })),
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/hooks/use-cursors-pref", () => ({
  useCursorsHidden: vi.fn(() => false),
}));
vi.mock("@/lib/utils/cursor-pref", () => ({
  setCursorsHidden: vi.fn(),
}));
vi.mock("@/lib/hooks/use-element-size", () => ({
  useElementSize: vi.fn(() => ({ width: 800, height: 600 })),
}));
vi.mock("@/lib/hooks/use-cursor-broadcast", () => ({
  useCursorBroadcast: vi.fn(() => ({ onPointerMove: vi.fn(), onPointerLeave: vi.fn() })),
}));
vi.mock("@/lib/hooks/use-board-dnd", () => ({
  useBoardDnD: vi.fn(({ initialTasks }: { initialTasks: TasksMap }) => ({
    activeTaskId: null,
    localTasks: initialTasks,
    handlers: { onDragStart: vi.fn(), onDragOver: vi.fn(), onDragEnd: vi.fn() },
  })),
}));
vi.mock("@/lib/hooks/use-column-dnd", () => ({
  useColumnDnD: vi.fn(({ initialColumns }: { initialColumns: Column[] }) => ({
    columns: initialColumns,
    activeColumnId: null,
    onColumnDragStart: vi.fn(),
    onColumnDragEnd: vi.fn(),
  })),
}));

// -- Stub KanbanColumn with test controls --
vi.mock("@/components/kanban/kanban-column", () => ({
  KanbanColumn: ({
    column,
    tasks,
    onTaskClick,
    onDeleteColumn,
  }: {
    column: Column;
    tasks: Task[];
    onTaskClick: (task: Task) => void;
    onDeleteColumn: (col: Column) => void;
  }) => (
    <div data-testid={`stub-col-${column.id}`}>
      <span>{column.name}</span>
      <span data-testid={`task-count-${column.id}`}>{tasks.length}</span>
      <button
        onClick={() => {
          onDeleteColumn(column);
        }}
      >
        Delete {column.name}
      </button>
      {tasks.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            onTaskClick(t);
          }}
        >
          Open {t.title}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/kanban/add-column-button", () => ({
  AddColumnButton: ({ onAdd }: { onAdd: (name: string) => void }) => (
    <button
      data-testid="add-column-btn"
      onClick={() => {
        onAdd("New Column");
      }}
    >
      Add column
    </button>
  ),
}));

vi.mock("@/components/task/task-detail-panel", () => ({
  TaskDetailPanel: ({ task, onClose }: { task: { title: string }; onClose: () => void }) => (
    <div data-testid="task-detail-panel">
      <span>{task.title}</span>
      <button onClick={onClose}>Close panel</button>
    </div>
  ),
}));

vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onClose,
    title,
  }: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm delete</button>
        <button onClick={onClose}>Cancel delete</button>
      </div>
    ) : null,
}));

vi.mock("@/components/common/user-avatar", () => ({
  UserAvatar: ({ user }: { user: { name?: string | null } }) => (
    <span data-testid="viewer-avatar">{user.name ?? "?"}</span>
  ),
}));

// -- Helpers --
const COL_A = makeColumn({ id: "col-1", name: "To Do" });
const COL_B = makeColumn({ id: "col-2", name: "In Progress" });
const TASK_A = makeTask({ id: "task-1", title: "Fix login bug", columnId: "col-1" });
const TASK_B = makeTask({ id: "task-2", title: "Add dark mode", columnId: "col-1" });
const LABEL_BUG = makeLabel("label-bug", "Bug");

const BASE_INITIAL_TASKS: TasksMap = {
  "col-1": [TASK_A, TASK_B],
  "col-2": [],
};

let deleteColumnMutation: ReturnType<typeof wireCapturableMutation>;
let addColumnMutation: ReturnType<typeof wireCapturableMutation>;

function buildProps(
  overrides: Partial<Parameters<typeof KanbanBoard>[0]> = {},
): Parameters<typeof KanbanBoard>[0] {
  return {
    orgId: "org-1",
    projectId: "proj-1",
    boardId: "board-1",
    boardName: "Main Board",
    columns: [COL_A, COL_B],
    initialTasks: BASE_INITIAL_TASKS,
    labelsByTask: {},
    presence: [],
    cursors: [],
    ...overrides,
  };
}

// -- Tests --
describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: vi.fn(),
    });

    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.orgs.members, []);
    mockUseQuery(api.tasks.labelsByProject, []);
    mockApiUtils();

    deleteColumnMutation = wireCapturableMutation(api.boards.deleteColumn);
    addColumnMutation = wireCapturableMutation(api.boards.addColumn);
  });

  // -- boardCollisionDetection (pure function) --

  describe("boardCollisionDetection", () => {
    const colContainer = (id: string) => ({
      id,
      data: { current: { type: "column" as const } },
      rect: { current: {} },
      disabled: false,
      node: { current: null },
    });

    const taskContainer = (id: string) => ({
      id,
      data: { current: { type: "task" as const } },
      rect: { current: {} },
      disabled: false,
      node: { current: null },
    });

    const droppables = [colContainer("col-1"), taskContainer("task-1"), colContainer("col-2")];

    beforeEach(() => {
      vi.mocked(closestCenter).mockReset();
    });

    it("filters droppableContainers to only columns when dragging a column", () => {
      boardCollisionDetection({
        active: { id: "col-1", data: { current: { type: "column" } }, rect: { current: {} } },
        droppableContainers: droppables,
        collisionRect: {} as DOMRect,
        droppableRects: new Map(),
        pointerCoordinates: null,
      } as never);

      const lastCall = vi.mocked(closestCenter).mock.calls.at(-1);
      const callArgs = lastCall?.[0] as unknown as { droppableContainers: typeof droppables };
      expect(callArgs.droppableContainers.every((c) => c.data.current.type === "column")).toBe(
        true,
      );
    });

    it("excludes task containers from collision candidates when dragging a column", () => {
      boardCollisionDetection({
        active: { id: "col-1", data: { current: { type: "column" } }, rect: { current: {} } },
        droppableContainers: droppables,
        collisionRect: {} as DOMRect,
        droppableRects: new Map(),
        pointerCoordinates: null,
      } as never);

      const lastCall = vi.mocked(closestCenter).mock.calls.at(-1);
      const callArgs = lastCall?.[0] as unknown as { droppableContainers: typeof droppables };
      expect(callArgs.droppableContainers).toHaveLength(2);
    });

    it("passes all containers to closestCenter when dragging a task", () => {
      boardCollisionDetection({
        active: { id: "task-1", data: { current: { type: "task" } }, rect: { current: {} } },
        droppableContainers: droppables,
        collisionRect: {} as DOMRect,
        droppableRects: new Map(),
        pointerCoordinates: null,
      } as never);

      const lastCall = vi.mocked(closestCenter).mock.calls.at(-1);
      const callArgs = lastCall?.[0] as unknown as { droppableContainers: typeof droppables };
      expect(callArgs.droppableContainers).toHaveLength(3);
    });
  });

  // -- Column rendering --

  it("renders a stub column for each column in the columns prop", () => {
    renderUI(<KanbanBoard {...buildProps()} />);

    expect(screen.getByTestId("stub-col-col-1")).toBeInTheDocument();
    expect(screen.getByTestId("stub-col-col-2")).toBeInTheDocument();
  });

  it("renders the board name via InlineEditText", () => {
    renderUI(<KanbanBoard {...buildProps()} />);

    expect(screen.getByRole("textbox", { name: /board name/i })).toHaveValue("Main Board");
  });

  it("renders the 'Add column' button", () => {
    renderUI(<KanbanBoard {...buildProps()} />);

    expect(screen.getByTestId("add-column-btn")).toBeInTheDocument();
  });

  it("calls addColumn mutation when AddColumnButton fires", () => {
    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByTestId("add-column-btn"));

    expect(addColumnMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      boardId: "board-1",
      name: "New Column",
    });
  });

  // -- Cursors toggle --

  it("renders the cursors toggle button with 'Hide live cursors' label when cursors are visible", async () => {
    const { useCursorsHidden } = await import("@/lib/hooks/use-cursors-pref");
    vi.mocked(useCursorsHidden).mockReturnValue(false);
    renderUI(<KanbanBoard {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Hide live cursors" })).toBeInTheDocument();
  });

  it("renders the cursors toggle button with 'Show live cursors' label when cursors are hidden", async () => {
    const { useCursorsHidden } = await import("@/lib/hooks/use-cursors-pref");
    vi.mocked(useCursorsHidden).mockReturnValue(true);
    renderUI(<KanbanBoard {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Show live cursors" })).toBeInTheDocument();
  });

  it("calls setCursorsHidden with the toggled value when the cursor button is clicked", async () => {
    const { useCursorsHidden } = await import("@/lib/hooks/use-cursors-pref");
    const { setCursorsHidden } = await import("@/lib/utils/cursor-pref");
    vi.mocked(useCursorsHidden).mockReturnValue(false);

    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide live cursors" }));

    expect(vi.mocked(setCursorsHidden)).toHaveBeenCalledWith(true);
  });

  // -- Presence viewer stack --

  it("renders a viewer avatar for the current user when session is available", () => {
    renderUI(<KanbanBoard {...buildProps({ presence: [] })} />);

    // Current user is always included in viewers
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders avatars for up to 5 viewers without an overflow count", () => {
    const presence: SocketPresenceUser[] = [
      { userId: "u2", name: "Bob", color: "#111" },
      { userId: "u3", name: "Carol", color: "#222" },
      { userId: "u4", name: "Dave", color: "#333" },
      { userId: "u5", name: "Eve", color: "#444" },
    ];
    renderUI(<KanbanBoard {...buildProps({ presence })} />);

    // 1 self + 4 peers = 5 total - no overflow
    expect(screen.getAllByTestId("viewer-avatar")).toHaveLength(5);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("renders '+N' overflow text when more than 5 viewers are present", () => {
    const presence: SocketPresenceUser[] = Array.from({ length: 6 }, (_, i) => ({
      userId: `u${String(i + 2)}`,
      name: `User ${String(i + 2)}`,
      color: "#000",
    }));
    renderUI(<KanbanBoard {...buildProps({ presence })} />);

    // 1 self + 6 peers = 7 total -> shows first 5 + "+2"
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  // -- Label filter --

  it("renders a filter pill for each org label", () => {
    mockUseQuery(api.labels.list, [LABEL_BUG]);

    renderUI(<KanbanBoard {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Bug" })).toBeInTheDocument();
  });

  it("marks a label filter pill as active (aria-pressed=true) when clicked", () => {
    mockUseQuery(api.labels.list, [LABEL_BUG]);

    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Bug" }));

    expect(screen.getByRole("button", { name: "Bug" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the Clear button when at least one label filter is active", async () => {
    mockUseQuery(api.labels.list, [LABEL_BUG]);

    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Bug" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    });
  });

  it("removes the Clear button and deactivates filter pills when Clear is clicked", async () => {
    mockUseQuery(api.labels.list, [LABEL_BUG]);

    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Bug" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Bug" })).toHaveAttribute("aria-pressed", "false");
  });

  // -- Delete column flow --

  it("opens ConfirmDialog when the stub column's delete button is clicked", () => {
    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete To Do" }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete column")).toBeInTheDocument();
  });

  it("calls deleteColumn mutation when ConfirmDialog confirm is clicked", () => {
    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete To Do" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteColumnMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      columnId: COL_A.id,
    });
  });

  it("closes ConfirmDialog without calling mutate when Cancel is clicked", async () => {
    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete To Do" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
    expect(deleteColumnMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Task detail panel --

  it("opens TaskDetailPanel when the stub column's task button is clicked", () => {
    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Fix login bug" }));

    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });

  it("closes TaskDetailPanel when its onClose callback fires", () => {
    renderUI(<KanbanBoard {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Fix login bug" }));

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));

    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });

  it("does NOT render TaskDetailPanel before any task is clicked", () => {
    renderUI(<KanbanBoard {...buildProps()} />);

    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });
});
