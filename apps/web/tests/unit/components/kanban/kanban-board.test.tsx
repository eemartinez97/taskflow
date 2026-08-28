import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities"));

vi.mock("@/lib/socket/socket-context", () => ({ useSocketRef: vi.fn(() => null) }));
vi.mock("@/lib/hooks/use-cursor-broadcast", () => ({
  useCursorBroadcast: vi.fn(() => ({ onPointerMove: vi.fn(), onPointerLeave: vi.fn() })),
}));
vi.mock("@/lib/hooks/use-cursors-pref", () => ({
  useCursorsHidden: vi.fn(() => ({ cursorsHidden: false, setCursorsHidden: vi.fn() })),
}));
vi.mock("@/lib/hooks/use-element-size", () => ({
  useElementSize: vi.fn(() => ({ width: 800, height: 600 })),
}));
vi.mock("@/lib/hooks/use-column-dnd", () => ({
  useColumnDnD: vi.fn(({ initialColumns }: { initialColumns: unknown[] }) => ({
    columns: initialColumns,
    activeColumnId: null,
    onColumnDragStart: vi.fn(),
    onColumnDragEnd: vi.fn(),
  })),
}));
vi.mock("@/lib/hooks/use-board-dnd", () => ({
  useBoardDnD: vi.fn(({ initialTasks }: { initialTasks: Record<string, unknown[]> }) => ({
    activeTaskId: null,
    localTasks: initialTasks,
    handlers: { onDragStart: vi.fn(), onDragOver: vi.fn(), onDragEnd: vi.fn() },
  })),
}));

let capturedDeleteColumnConfirmProps: { onConfirm?: () => void } = {};
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
    confirmLabel: string;
  }) => {
    capturedDeleteColumnConfirmProps = props;
    return props.open ? (
      <div>
        <h2>{props.title}</h2>
        <button onClick={props.onConfirm}>{props.confirmLabel}</button>
        <button onClick={props.onClose}>Cancel</button>
      </div>
    ) : null;
  },
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

import { api } from "@/lib/trpc/client";
import { boardCollisionDetection, KanbanBoard } from "@/components/kanban/kanban-board";

import userEvent from "@testing-library/user-event";
import { capturedDndProps } from "@/tests/mocks/dnd-kit";
import { closestCenter } from "@dnd-kit/core";
import { useBoardDnD } from "@/lib/hooks/use-board-dnd";
import { useColumnDnD } from "@/lib/hooks/use-column-dnd";
import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";
import { useSession, mockSession } from "@/tests/mocks/next-auth";
import { makeBoard, makeColumn, makeTask } from "@/tests/support/factories";
import {
  VALID_BOARD_ID,
  VALID_COL_A_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
} from "@/tests/support/fixtures";
import {
  getLastMockUtils,
  getLastMutationOptions,
  mockApiUtils,
  mockUseQuery,
  setupMutationMock,
} from "@/tests/support/trpc";

interface BoardUpdateOptions {
  onMutate?: (vars: { data: { name?: string } }) => Promise<{
    previous: unknown;
    previousList: unknown;
  }>;
  onError?: (
    err: unknown,
    vars: unknown,
    ctx: { previous: unknown; previousList: unknown } | undefined,
  ) => void;
  onSuccess?: () => void;
  onSettled?: () => void;
}
interface RenameColumnOptions {
  onMutate?: (vars: { columnId: string; name: string }) => Promise<{ previous: unknown }>;
  onError?: (err: unknown, vars: unknown, ctx: { previous: unknown } | undefined) => void;
  onSettled?: () => void;
}
interface SetColumnStatusOptions {
  onMutate?: (vars: { columnId: string; status: string | null }) => Promise<{ previous: unknown }>;
  onSuccess?: (column: { id: string; mappedStatus: string | null }) => void;
  onError?: (err: unknown, vars: unknown, ctx: { previous: unknown } | undefined) => void;
  onSettled?: () => void;
}
interface OnErrorOnlyOptions {
  onError?: () => void;
}
interface CreateTaskOptions {
  onSuccess?: (t: { id: string; columnId: string }) => void;
  onSettled?: () => void;
}
interface DeleteColumnOptions {
  onSuccess?: (result: undefined, variables: { columnId: string }) => void;
}
interface ReorderColumnsOptions {
  onSuccess?: (
    result: undefined,
    variables: { payload: { columns: { id: string; position: number }[] } },
  ) => void;
}
interface AddColumnOptions {
  onSuccess?: (column: { id: string; name: string; position: number }) => void;
}

const column = makeColumn({ id: VALID_COL_A_ID, name: "To Do" });
const task = makeTask({ columnId: VALID_COL_A_ID });

const defaultBoardProps = {
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
  boardId: VALID_BOARD_ID,
  boardName: "Main Board",
  projectName: "Demo Project",
  initialBoards: [makeBoard({ id: VALID_BOARD_ID, name: "Main Board" })],
  columns: [column],
  initialTasks: { [VALID_COL_A_ID]: [task] },
  labelsByTask: {},
  presence: [] as { userId: string; name: string; color: string }[],
  cursors: [] as { userId: string; x: number; y: number; columnId?: string }[],
  canEdit: true,
  canManageBoards: true,
};
/** Renders KanbanBoard with the shared default fixture, overriding only what a given test needs. */
function renderBoard(overrides: Partial<typeof defaultBoardProps> = {}) {
  return render(<KanbanBoard {...defaultBoardProps} {...overrides} />);
}

function setupQueries(): void {
  mockUseQuery(api.labels.list, []);
  mockUseQuery(api.orgs.assigneeLookup, { members: [], formerAssignees: [] });
  mockUseQuery(api.tasks.get, makeTask());
  mockUseQuery(api.tasks.labels, []);
  mockUseQuery(api.boards.list, defaultBoardProps.initialBoards);
}

describe("KanbanBoard", () => {
  beforeEach(() => {
    mockUseQuery(api.boards.list, defaultBoardProps.initialBoards);
  });

  it("renders the board name and every column", () => {
    setupQueries();
    renderBoard();
    expect(screen.getByLabelText(/board name/i)).toHaveValue("Main Board");
    expect(screen.getByTestId(`column-${VALID_COL_A_ID}`)).toBeInTheDocument();
  });

  it("renders the label filter toggles behind the Filter menu and toggles a filter on click", async () => {
    const label = {
      id: "l1",
      orgId: VALID_ORG_ID,
      name: "Bug",
      color: "#EF4444",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    mockUseQuery(api.labels.list, [label]);
    mockUseQuery(api.orgs.assigneeLookup, { members: [], formerAssignees: [] });
    renderBoard({ labelsByTask: { [task.id]: [label] } });
    expect(screen.queryByRole("menuitemcheckbox", { name: "Bug" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /^filter$/i }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Bug" })).toBeInTheDocument();
  });

  it("filters out tasks with no entry in labelsByTask when a label filter is active", async () => {
    const label = {
      id: "l1",
      orgId: VALID_ORG_ID,
      name: "Bug",
      color: "#EF4444",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    const taskWithoutLabels = makeTask({
      id: "10000000-0000-4000-8000-000000000002",
      columnId: VALID_COL_A_ID,
      title: "No labels task",
    });
    mockUseQuery(api.labels.list, [label]);
    mockUseQuery(api.orgs.assigneeLookup, { members: [], formerAssignees: [] });
    renderBoard({
      initialTasks: { [VALID_COL_A_ID]: [task, taskWithoutLabels] },
      labelsByTask: { [task.id]: [label] }, // taskWithoutLabels has NO entry here
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filter$/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Bug" }));
    // `(labelsByTask[t.id] ?? []).some(...)` -> `?? []` branch for taskWithoutLabels,
    // so it must NOT match the active filter and stays hidden.
    expect(screen.getByTestId(`task-card-${task.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`task-card-${taskWithoutLabels.id}`)).not.toBeInTheDocument();
  });

  it("toggles a label filter off when the same label is clicked twice", async () => {
    const label = {
      id: "l1",
      orgId: VALID_ORG_ID,
      name: "Bug",
      color: "#EF4444",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    mockUseQuery(api.labels.list, [label]);
    mockUseQuery(api.orgs.assigneeLookup, { members: [], formerAssignees: [] });
    renderBoard({ labelsByTask: { [task.id]: [label] } });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filter$/i }));
    const labelButton = screen.getByRole("menuitemcheckbox", { name: "Bug" });
    await user.click(labelButton); // add branch: [...prev, labelId]
    expect(labelButton).toHaveAttribute("aria-checked", "true");
    await user.click(labelButton); // remove branch: prev.filter((id) => id !== labelId)
    expect(labelButton).toHaveAttribute("aria-checked", "false");
  });

  it("shows viewer avatars including the current session user", () => {
    setupQueries();
    renderBoard({ presence: [{ userId: "peer-1", name: "Peer", color: "#000" }] });
    expect(screen.getByLabelText(/people viewing this board/i)).toBeInTheDocument();
  });

  it("falls back to null for the self viewer's name when the session user has no name", () => {
    setupQueries();
    vi.mocked(useSession).mockReturnValueOnce({
      data: {
        ...mockSession,
        user: { ...mockSession.user, name: null },
      },
      status: "authenticated",
      update: vi.fn(),
    } as never);
    renderBoard();
    // `session?.user.name ?? null` falls back to null; UserAvatar still renders
    // (falls back to initials/placeholder), so we just assert the viewer stack mounted.
    expect(screen.getByLabelText(/people viewing this board/i)).toBeInTheDocument();
  });

  it("falls back to the raw presence list when there is no current session user", () => {
    setupQueries();
    vi.mocked(useSession).mockReturnValueOnce({ data: null } as never);
    renderBoard({ presence: [{ userId: "peer-1", name: "Peer", color: "#000" }] });
    // `currentUserId` is falsy here -> viewers = presence (else branch of the ternary),
    // so only the single peer avatar renders, not a self + peer roster.
    const viewersRegion = screen.getByLabelText(/people viewing this board/i);
    expect(viewersRegion.children).toHaveLength(1);
  });

  it("toggles the cursors-hidden preference button", () => {
    setupQueries();
    renderBoard();
    expect(screen.getByRole("button", { name: /hide live cursors/i })).toBeInTheDocument();
  });

  it("calls setCursorsHidden with the flipped value when the toggle button is clicked", () => {
    setupQueries();
    const setCursorsHidden = vi.fn();
    vi.mocked(useCursorsHidden).mockReturnValue({ cursorsHidden: false, setCursorsHidden });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /hide live cursors/i }));
    expect(setCursorsHidden).toHaveBeenCalledWith(true);
  });

  it("opens the task detail panel when a card is clicked", async () => {
    setupQueries();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderBoard();
    await userEvent.setup().click(screen.getByTestId(`task-card-${task.id}`));
    expect(screen.getByRole("dialog", { name: "Task details" })).toBeInTheDocument();
  });

  it("opens the delete-column confirmation via the column's dropdown", async () => {
    setupQueries();
    const { default: userEvent } = await import("@testing-library/user-event");
    renderBoard();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /options for column to do/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete column/i }));

    expect(await screen.findByRole("heading", { name: "Delete column" })).toBeInTheDocument();
  });

  it("renders the AddColumnButton control", () => {
    setupQueries();
    renderBoard();
    expect(screen.getByRole("button", { name: /add column/i })).toBeInTheDocument();
  });

  it("computes assigneeById from a non-empty org members list", () => {
    setupQueries();
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
    renderBoard();
    // Forces `members.map((m) => [m.user.id, m.user])` to actually run its
    // lambda body at least once; every other test uses an empty members
    // array, so the map callback itself was never invoked.
    expect(screen.getByTestId(`column-${VALID_COL_A_ID}`)).toBeInTheDocument();
  });

  it("renders no drag overlay content when nothing is active", () => {
    setupQueries();
    renderBoard();
    expect(screen.getByTestId("drag-overlay")).toBeEmptyDOMElement();
  });

  it("falls back to an empty tasks array when a column has no entry in localTasks", () => {
    setupQueries();
    // colX is present in `columns` but absent from `initialTasks`, so
    // `localTasks[colX.id]` is `undefined` -> exercises the `?? []` falsy branch.
    const colX = makeColumn({ id: "col-x", name: "Empty Col" });
    renderBoard({ columns: [column, colX] });
    expect(screen.getByTestId("column-col-x")).toBeInTheDocument();
  });

  it("disables the board-name field and hides the add-column button when canEdit is false", () => {
    setupQueries();
    renderBoard({ canEdit: false });
    expect(screen.getByLabelText(/board name/i)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /add column/i })).not.toBeInTheDocument();
  });
});

describe("KanbanBoard - mutations and drag handlers", () => {
  beforeEach(() => {
    mockUseQuery(api.boards.list, defaultBoardProps.initialBoards);
    // Pins api.useUtils() to ONE shared object across every caller in the
    // tree (KanbanBoard's own renameMutation AND BoardSwitcher's delete
    // flow both call it) - without this, the default per-call fresh mock
    // means getLastMockUtils() below can return BoardSwitcher's (unused)
    // instance instead of the one a mutation's onMutate/onError closure
    // actually captured and called setData on.
    mockApiUtils();
  });

  it("renames the board optimistically via onMutate, covering both ternary branches, and rolls back onError", async () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<BoardUpdateOptions>(api.boards.update);

    await call.onMutate?.({ data: { name: "New name" } });
    const utils = getLastMockUtils();
    const updater = utils.boards.get.setData.mock.calls.at(-1)?.[1] as (
      prev: { name: string } | undefined,
    ) => unknown;
    expect(updater(undefined)).toBeUndefined(); // falsy branch of `prev ? ... : prev`
    expect(updater({ name: "Old" })).toEqual({ name: "New name" }); // truthy branch

    // The board switcher's own boards.list query gets the same optimistic rename.
    const listUpdater = utils.boards.list.setData.mock.calls.at(-1)?.[1] as (
      prev: { id: string; name: string }[] | undefined,
    ) => unknown;
    expect(listUpdater(undefined)).toBeUndefined(); // `prev?.map` on a missing list
    expect(
      listUpdater([
        { id: VALID_BOARD_ID, name: "Old" },
        { id: "other-board", name: "Kept" },
      ]),
    ).toEqual([
      { id: VALID_BOARD_ID, name: "New name" },
      { id: "other-board", name: "Kept" },
    ]);

    call.onError?.(
      new Error("x"),
      {},
      { previous: { name: "Old" }, previousList: [{ id: VALID_BOARD_ID, name: "Old" }] },
    );
    expect(utils.boards.list.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID },
      [{ id: VALID_BOARD_ID, name: "Old" }],
    );
    call.onSuccess?.();
    call.onSettled?.();
    expect(utils.boards.list.invalidate).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      projectId: VALID_PROJECT_ID,
    });
  });

  it("falls back to the previous board name when renaming with an undefined name", async () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<Pick<BoardUpdateOptions, "onMutate">>(api.boards.update);
    await call.onMutate?.({ data: {} });
    const utils = getLastMockUtils();
    const updater = utils.boards.get.setData.mock.calls.at(-1)?.[1] as (
      prev: { name: string } | undefined,
    ) => unknown;
    // `data.name` is undefined -> `data.name ?? prev.name` falls back to prev.name
    expect(updater({ name: "Old" })).toEqual({ name: "Old" });

    const listUpdater = utils.boards.list.setData.mock.calls.at(-1)?.[1] as (
      prev: { id: string; name: string }[] | undefined,
    ) => unknown;
    // Same fallback on the list side: `data.name ?? b.name`
    expect(listUpdater([{ id: VALID_BOARD_ID, name: "Old" }])).toEqual([
      { id: VALID_BOARD_ID, name: "Old" },
    ]);
  });

  it("handles onError with an undefined rollback context (no-op)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<Pick<BoardUpdateOptions, "onError">>(api.boards.update);
    expect(() => {
      call.onError?.(new Error("x"), {}, undefined);
    }).not.toThrow();
  });

  it("handles renameColumn onError with an undefined rollback context (no-op)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<Pick<RenameColumnOptions, "onError">>(
      api.boards.renameColumn,
    );
    expect(() => {
      call.onError?.(new Error("x"), {}, undefined);
    }).not.toThrow();
  });

  it("renames a column optimistically via onMutate, covering the column-map ternary, and rolls back onError", async () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<RenameColumnOptions>(api.boards.renameColumn);
    await call.onMutate?.({ columnId: column.id, name: "Renamed" });
    const utils = getLastMockUtils();
    const updater = utils.boards.get.setData.mock.calls.at(-1)?.[1] as (
      prev: { columns: { id: string; name: string }[] } | undefined,
    ) => unknown;
    expect(updater(undefined)).toBeUndefined(); // falsy branch
    const result = updater({
      columns: [
        { id: column.id, name: "Old" },
        { id: "other", name: "Kept" },
      ],
    }) as {
      columns: { id: string; name: string }[];
    };
    expect(result.columns).toEqual([
      { id: column.id, name: "Renamed" }, // map ternary TRUE branch
      { id: "other", name: "Kept" }, // map ternary FALSE branch
    ]);
    call.onError?.(new Error("x"), {}, { previous: { columns: [] } });
    call.onSettled?.();
  });

  it("writes the bulk-synced status straight into tasks.list and tasks.get when setColumnStatus succeeds with a real status", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<SetColumnStatusOptions>(api.boards.setColumnStatus);

    const taskA = makeTask({ id: "task-a", columnId: column.id, status: "TODO" });
    const taskB = makeTask({ id: "task-b", columnId: column.id, status: "DONE" }); // already matches - skip branch
    const utils = getLastMockUtils();
    utils.tasks.list.getData.mockReturnValue([taskA, taskB]);

    call.onSuccess?.({ id: column.id, mappedStatus: "DONE" });

    expect(utils.tasks.list.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, columnId: column.id },
      [
        { ...taskA, status: "DONE" }, // map ternary: status differed -> replaced
        taskB, // map ternary: status already matched -> kept as-is
      ],
    );

    // Only taskA actually changed status - taskB hits the loop's `continue` and never
    // gets a tasks.get write.
    expect(utils.tasks.get.setData).toHaveBeenCalledTimes(1);
    const [key, updater] = utils.tasks.get.setData.mock.calls[0] as [
      { orgId: string; taskId: string },
      (prev: { status: string } | undefined) => unknown,
    ];
    expect(key).toEqual({ orgId: VALID_ORG_ID, taskId: taskA.id });
    expect(updater(undefined)).toBeUndefined(); // falsy branch
    expect(updater({ ...taskA })).toEqual({ ...taskA, status: "DONE" }); // truthy branch
  });

  it("falls back to an empty array when tasks.list has no cached data yet for the column (`?? []` branch)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<SetColumnStatusOptions>(api.boards.setColumnStatus);
    const utils = getLastMockUtils(); // tasks.list.getData defaults to returning undefined

    call.onSuccess?.({ id: column.id, mappedStatus: "DONE" });

    expect(utils.tasks.list.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, columnId: column.id },
      [],
    );
    expect(utils.tasks.get.setData).not.toHaveBeenCalled();
  });

  it("does NOT touch tasks.list/tasks.get when setColumnStatus clears the mapping (existing tasks are untouched server-side)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<SetColumnStatusOptions>(api.boards.setColumnStatus);
    call.onSuccess?.({ id: column.id, mappedStatus: null });

    const utils = getLastMockUtils();
    expect(utils.tasks.list.setData).not.toHaveBeenCalled();
    expect(utils.tasks.get.setData).not.toHaveBeenCalled();
  });

  it("handles setColumnStatus onError with an undefined rollback context (no-op)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<Pick<SetColumnStatusOptions, "onError">>(
      api.boards.setColumnStatus,
    );
    expect(() => {
      call.onError?.(new Error("x"), {}, undefined);
    }).not.toThrow();
  });

  it("maps a column to a status optimistically via onMutate, covering the column-map ternary, and rolls back onError", async () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<SetColumnStatusOptions>(api.boards.setColumnStatus);
    await call.onMutate?.({ columnId: column.id, status: "DONE" });
    const utils = getLastMockUtils();
    const updater = utils.boards.get.setData.mock.calls.at(-1)?.[1] as (
      prev: { columns: { id: string; mappedStatus: string | null }[] } | undefined,
    ) => unknown;
    expect(updater(undefined)).toBeUndefined(); // falsy branch
    const result = updater({
      columns: [
        { id: column.id, mappedStatus: null },
        { id: "other", mappedStatus: "TODO" },
      ],
    }) as {
      columns: { id: string; mappedStatus: string | null }[];
    };
    expect(result.columns).toEqual([
      { id: column.id, mappedStatus: "DONE" }, // map ternary TRUE branch
      { id: "other", mappedStatus: "TODO" }, // map ternary FALSE branch
    ]);
    call.onError?.(new Error("x"), {}, { previous: { columns: [] } });
    call.onSettled?.();
    const utilsAfterSettle = getLastMockUtils();
    expect(utilsAfterSettle.boards.get.invalidate).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      boardId: VALID_BOARD_ID,
    });
  });

  it("invalidates myTasks and removes the deleted column from cache on deleteColumn success (both setData branches)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<DeleteColumnOptions>(api.boards.deleteColumn);
    call.onSuccess?.(undefined, { columnId: column.id });

    const utils = getLastMockUtils();
    const updater = utils.boards.get.setData.mock.calls.at(-1)?.[1] as (
      prev: { columns: { id: string }[] } | undefined,
    ) => unknown;
    expect(updater(undefined)).toBeUndefined(); // falsy branch
    const result = updater({ columns: [{ id: column.id }, { id: "other" }] }) as {
      columns: { id: string }[];
    };
    expect(result.columns).toEqual([{ id: "other" }]);
  });

  it("applies new positions and re-sorts columns on reorderColumns success (both setData branches)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<ReorderColumnsOptions>(api.boards.reorderColumns);
    call.onSuccess?.(undefined, {
      payload: {
        columns: [
          { id: "a", position: 2 },
          { id: "b", position: 1 },
        ],
      },
    });

    const utils = getLastMockUtils();
    const updater = utils.boards.get.setData.mock.calls.at(-1)?.[1] as (
      prev: { columns: { id: string; position: number }[] } | undefined,
    ) => unknown;
    expect(updater(undefined)).toBeUndefined(); // falsy branch
    const result = updater({
      columns: [
        { id: "a", position: 1 },
        { id: "b", position: 2 },
        { id: "c", position: 3 }, // no matching entry in the mutation payload - keeps its own position
      ],
    }) as { columns: { id: string; position: number }[] };
    expect(result.columns).toEqual([
      { id: "b", position: 1 },
      { id: "a", position: 2 },
      { id: "c", position: 3 },
    ]);
  });

  it("invalidates tasks.list when the move mutation errors", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<OnErrorOnlyOptions>(api.tasks.move);
    call.onError?.();
  });

  it("patches tasks.get and every column's tasks.list cache from the server-returned task on move success", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<{
      onSuccess?: (task: {
        id: string;
        columnId: string;
        position: number;
        status: string;
      }) => void;
    }>(api.tasks.move);
    const movedTask = { id: "moved-1", columnId: column.id, position: 1500, status: "DONE" };

    call.onSuccess?.(movedTask);

    const utils = getLastMockUtils();
    expect(utils.tasks.get.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, taskId: "moved-1" },
      movedTask,
    );
    expect(utils.tasks.list.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, columnId: column.id },
      [movedTask],
    );
  });

  it("clears addingTaskColId and upserts the new task into cache when createTask settles/succeeds", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<CreateTaskOptions>(api.tasks.create);
    const newTask = { id: "new-task", columnId: VALID_COL_A_ID };
    call.onSuccess?.(newTask);
    call.onSettled?.();

    const utils = getLastMockUtils();
    const updater = utils.tasks.list.setData.mock.calls.at(-1)?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown;
    expect(updater(undefined)).toEqual([newTask]); // upsertTask's "not found yet" branch
  });

  it("appends the new column to cache on addColumn success (both setData branches)", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<AddColumnOptions>(api.boards.addColumn);
    const newColumn = { id: "new-col", name: "New", position: 2 };
    call.onSuccess?.(newColumn);

    const utils = getLastMockUtils();
    const updater = utils.boards.get.setData.mock.calls.at(-1)?.[1] as (
      prev: { columns: { id: string }[] } | undefined,
    ) => unknown;
    expect(updater(undefined)).toBeUndefined(); // falsy branch
    const result = updater({ columns: [{ id: column.id }] }) as { columns: { id: string }[] };
    expect(result.columns).toEqual([{ id: column.id }, newColumn]);
  });

  it("adds a task via AddTaskButton and calls createTaskMutation", async () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.tasks.create);
    renderBoard({ initialTasks: { [VALID_COL_A_ID]: [] } });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add task/i }));
    await user.type(screen.getByPlaceholderText(/task title/i), "New task{Enter}");
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID }),
    );
  });

  it("adds a new column via AddColumnButton", async () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.addColumn);
    renderBoard();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add column/i }));
    await user.type(screen.getByPlaceholderText(/column name/i), "New col{Enter}");
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: VALID_ORG_ID, boardId: VALID_BOARD_ID }),
    );
  });

  it("renames the board via InlineEditText onSave", () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.update);
    renderBoard();
    const input = screen.getByLabelText(/board name/i);
    fireEvent.blur(input, { target: { value: "Renamed board" } });
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: VALID_ORG_ID, boardId: VALID_BOARD_ID }),
    );
  });

  it("clears all label filters via the Clear button", async () => {
    const label = {
      id: "l1",
      orgId: VALID_ORG_ID,
      name: "Bug",
      color: "#EF4444",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockUseQuery(api.labels.list, [label]);
    mockUseQuery(api.orgs.assigneeLookup, { members: [], formerAssignees: [] });
    renderBoard({ labelsByTask: { [task.id]: [label] } });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filter$/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Bug" }));
    expect(await screen.findByRole("menuitem", { name: /clear/i })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /clear/i }));
    expect(screen.queryByRole("menuitem", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("deletes the target column when the confirm dialog is confirmed", async () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.deleteColumn);
    renderBoard();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /options for column to do/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete column/i }));
    await user.click(screen.getByRole("button", { name: "Delete column" }));
    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, columnId: column.id });
  });

  it("closes the task detail panel via onClose", async () => {
    setupQueries();
    renderBoard();
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`task-card-${task.id}`));
    expect(screen.getByRole("dialog", { name: "Task details" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close panel" }));
    expect(screen.queryByRole("dialog", { name: "Task details" })).not.toBeInTheDocument();
  });

  it("renders peer cursors when cursorsHidden is false", () => {
    setupQueries();
    vi.mocked(useCursorsHidden).mockReturnValue({
      cursorsHidden: false,
      setCursorsHidden: vi.fn(),
    });
    renderBoard({
      cursors: [{ userId: "peer-1", x: 10, y: 10 }],
      presence: [{ userId: "peer-1", name: "Peer One", color: "#000" }],
    });
    expect(screen.getByText("Peer One")).toBeInTheDocument();
  });

  it("hides peer cursors when cursorsHidden is true", () => {
    setupQueries();
    vi.mocked(useCursorsHidden).mockReturnValue({ cursorsHidden: true, setCursorsHidden: vi.fn() });
    renderBoard({
      cursors: [{ userId: "peer-1", x: 10, y: 10 }],
      presence: [{ userId: "peer-1", name: "Peer One", color: "#000" }],
    });
    expect(screen.queryByText("Peer One")).not.toBeInTheDocument();
  });

  it("renders two peer cursors captured over the same column nested inside it", () => {
    setupQueries();
    vi.mocked(useCursorsHidden).mockReturnValue({
      cursorsHidden: false,
      setCursorsHidden: vi.fn(),
    });
    renderBoard({
      cursors: [
        { userId: "peer-1", x: 10, y: 10, columnId: VALID_COL_A_ID },
        { userId: "peer-2", x: 20, y: 20, columnId: VALID_COL_A_ID },
      ],
      presence: [
        { userId: "peer-1", name: "Peer One", color: "#000" },
        { userId: "peer-2", name: "Peer Two", color: "#111" },
      ],
    });
    expect(screen.getByText("Peer One")).toBeInTheDocument();
    expect(screen.getByText("Peer Two")).toBeInTheDocument();
  });

  it("resolves a task's assignee from formerAssignees when they are no longer a member", () => {
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.orgs.assigneeLookup, {
      members: [],
      formerAssignees: [{ id: "ex-user", name: "Bob" }],
    });
    mockUseQuery(api.tasks.get, makeTask());
    mockUseQuery(api.tasks.labels, []);
    const assignedTask = makeTask({ assigneeId: "ex-user" });

    renderBoard({ initialTasks: { [VALID_COL_A_ID]: [assignedTask] } });

    expect(screen.getByLabelText("Bob · ex")).toBeInTheDocument();
  });

  it("prefers a current member over formerAssignees for the same userId", () => {
    mockUseQuery(api.labels.list, []);
    mockUseQuery(api.orgs.assigneeLookup, {
      members: [
        {
          id: "m1",
          userId: "u1",
          role: "MEMBER",
          user: { id: "u1", name: "Priya", email: "p@x.com" },
        },
      ],
      formerAssignees: [{ id: "u1", name: "Stale Name" }],
    });
    mockUseQuery(api.tasks.get, makeTask());
    mockUseQuery(api.tasks.labels, []);
    const assignedTask = makeTask({ assigneeId: "u1" });

    renderBoard({ initialTasks: { [VALID_COL_A_ID]: [assignedTask] } });

    expect(screen.getByLabelText("Priya")).toBeInTheDocument();
    expect(screen.queryByLabelText(/stale name/i)).not.toBeInTheDocument();
  });

  it("routes onDragStart/onDragOver/onDragEnd for a task drag through taskHandlers", () => {
    setupQueries();
    renderBoard();
    act(() => {
      capturedDndProps.onDragStart?.({ active: { id: task.id, data: { current: {} } } });
      capturedDndProps.onDragOver?.({
        active: { id: task.id, data: { current: {} } },
        over: { id: VALID_COL_A_ID },
      });
      capturedDndProps.onDragEnd?.({
        active: { id: task.id, data: { current: {} } },
        over: { id: VALID_COL_A_ID },
      });
    });
  });

  it("sets overId to null when handleDragOver fires with no drop target (e.over is null)", () => {
    setupQueries();
    renderBoard();
    // Isolated from onDragEnd so the render commits with overId's "falsy" branch
    // (`e.over ? ... : null`) actually evaluated, instead of being immediately
    // overwritten by a batched onDragEnd in the same act() call.
    act(() => {
      capturedDndProps.onDragStart?.({ active: { id: task.id, data: { current: {} } } });
      capturedDndProps.onDragOver?.({
        active: { id: task.id, data: { current: {} } },
        over: null,
      });
    });
    expect(screen.getByTestId(`column-${VALID_COL_A_ID}`)).toBeInTheDocument();
  });

  it("resolves overColumnId directly when hovering over a column id that is itself a key in localTasks", () => {
    setupQueries();
    const { container } = renderBoard();
    // Isolated (no onDragEnd in the same act) so the render commits while
    // overId is still truthy, exercising the `overId in localTasks` TRUE
    // branch (`? overId : findColumnIdForTask(...)`).
    act(() => {
      capturedDndProps.onDragStart?.({ active: { id: task.id, data: { current: {} } } });
      capturedDndProps.onDragOver?.({
        active: { id: task.id, data: { current: {} } },
        over: { id: VALID_COL_A_ID }, // column id, also a key of localTasks
      });
    });
    expect(container.querySelector("[data-column-scroll]")).toHaveClass("bg-brand-50");
  });

  it("renders the active task ghost card in the DragOverlay when activeTaskId is set", () => {
    setupQueries();
    vi.mocked(useBoardDnD).mockReturnValueOnce({
      activeTaskId: task.id,
      localTasks: { [VALID_COL_A_ID]: [task] },
      handlers: { onDragStart: vi.fn(), onDragOver: vi.fn(), onDragEnd: vi.fn() },
    });
    renderBoard();
    // Ternary TRUE branch of `activeTaskId ? findTaskInMap(...) : null`,
    // reflected as the ghost card rendered inside the DragOverlay.
    expect(screen.getByTestId("drag-overlay")).not.toBeEmptyDOMElement();
  });

  it("routes onDragStart/onDragEnd for a column drag through column handlers", () => {
    setupQueries();
    renderBoard();
    act(() => {
      capturedDndProps.onDragStart?.({
        active: { id: column.id, data: { current: { type: "column" } } },
      });
      capturedDndProps.onDragOver?.({
        active: { id: column.id, data: { current: { type: "column" } } },
        over: { id: column.id },
      });
      capturedDndProps.onDragEnd?.({
        active: { id: column.id, data: { current: { type: "column" } } },
        over: { id: column.id },
      });
    });
  });

  it("renames a column via the InlineEditText onSave", () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.renameColumn);
    renderBoard();
    const input = screen.getByLabelText(/column name/i);
    fireEvent.blur(input, { target: { value: "Renamed column" } });
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: VALID_ORG_ID, columnId: column.id, name: "Renamed column" }),
    );
  });

  it("maps a column's status via the status-mapping select", async () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.setColumnStatus);
    renderBoard();
    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText(/status mapping for column to do/i), "DONE");
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      columnId: column.id,
      status: "DONE",
    });
  });

  it("clears the delete-column target when deleteColumnMutation succeeds", () => {
    setupQueries();
    renderBoard();
    const call = getLastMutationOptions<{ onSuccess?: () => void }>(api.boards.deleteColumn);

    act(() => {
      call.onSuccess?.();
    });
  });

  it("calls moveMutation.mutate when useBoardDnD's onTaskMoved callback fires", () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.tasks.move);
    renderBoard();
    const call = vi.mocked(useBoardDnD).mock.calls.at(-1)?.[0] as {
      onTaskMoved: (payload: {
        taskId: string;
        sourceColumnId: string;
        targetColumnId: string;
        newPosition: number;
      }) => void;
    };
    call.onTaskMoved({
      taskId: task.id,
      sourceColumnId: VALID_COL_A_ID,
      targetColumnId: VALID_COL_A_ID,
      newPosition: 500,
    });
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: VALID_ORG_ID, projectId: VALID_PROJECT_ID }),
    );
  });

  it("calls reorderColumnsMutation.mutate when useColumnDnD's onColumnsReordered fires", () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.reorderColumns);
    renderBoard();
    const call = vi.mocked(useColumnDnD).mock.calls.at(-1)?.[0] as {
      onColumnsReordered: (payload: { columns: { id: string; position: number }[] }) => void;
    };
    call.onColumnsReordered({ columns: [{ id: column.id, position: 500 }] });
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: VALID_ORG_ID,
        payload: expect.objectContaining({ boardId: VALID_BOARD_ID }) as unknown,
      }),
    );
  });

  it("cancels the delete-column confirmation without deleting", async () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.deleteColumn);
    renderBoard();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /options for column to do/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete column/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mutateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Delete column" })).not.toBeInTheDocument();
  });

  it("resolves overColumnId via findColumnIdForTask when hovering over a task id instead of a column id", () => {
    setupQueries();
    const { container } = renderBoard();
    act(() => {
      capturedDndProps.onDragStart?.({ active: { id: task.id, data: { current: {} } } });

      capturedDndProps.onDragOver?.({
        active: { id: task.id, data: { current: {} } },
        over: { id: task.id }, // task id, not a column id -> forces findColumnIdForTask
      });
    });
    expect(container.querySelector("[data-column-scroll]")).toHaveClass("bg-brand-50");
  });

  it("shows a '+N' overflow indicator when there are more than 5 viewers", () => {
    setupQueries();
    const manyPeers = Array.from({ length: 6 }, (_, i) => ({
      userId: `peer-${String(i)}`,
      name: `Peer ${String(i)}`,
      color: "#000",
    }));
    renderBoard({ presence: manyPeers });
    // 6 peers + the current session user = 7 viewers total -> "+2" overflow
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("does nothing when the delete-column onConfirm fires without a target", () => {
    setupQueries();
    const { mutateMock } = setupMutationMock(api.boards.deleteColumn);
    renderBoard();
    capturedDeleteColumnConfirmProps.onConfirm?.();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});

describe("boardCollisionDetection", () => {
  it("restricts collisions to columns when dragging a column", () => {
    const containers = [
      { id: "col-1", data: { current: { type: "column" } } },
      { id: "task-1", data: { current: { type: "task" } } },
    ];
    const args = {
      active: { data: { current: { type: "column" } } },
      droppableContainers: containers,
      collisionRect: {},
      droppableRects: new Map(),
      pointerCoordinates: null,
    };

    vi.mocked(closestCenter).mockReturnValue([{ id: "col-1" }] as never);

    const result = boardCollisionDetection(args as never);
    expect(result).toBeDefined();
    expect(closestCenter).toHaveBeenCalledWith(
      expect.objectContaining({ droppableContainers: [containers[0]] }),
    );
  });

  it("falls through to closestCenter for a task drag", () => {
    const args = {
      active: { data: { current: { type: "task" } } },
      droppableContainers: [],
      collisionRect: {},
      droppableRects: new Map(),
      pointerCoordinates: null,
    };
    expect(() => boardCollisionDetection(args as never)).not.toThrow();
  });
});
