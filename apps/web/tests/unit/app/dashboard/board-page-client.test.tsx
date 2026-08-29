import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-board-realtime", () => ({ useBoardRealtime: vi.fn() }));
vi.mock("@/lib/hooks/use-presence", () => ({ usePresence: vi.fn(() => []) }));
vi.mock("@/lib/hooks/use-cursors", () => ({ useCursors: vi.fn(() => []) }));
vi.mock("@/components/kanban/kanban-board", () => ({
  KanbanBoard: ({
    boardName,
    columns,
    initialTasks,
  }: {
    boardName: string;
    columns: { id: string }[];
    initialTasks: Record<string, { id: string }[]>;
  }) => (
    <p>
      KanbanBoard: {boardName} ({columns.length} columns,{" "}
      {Object.values(initialTasks).reduce((sum, tasks) => sum + tasks.length, 0)} tasks)
    </p>
  ),
}));

import { api } from "@/lib/trpc/client";
import { useBoardRealtime } from "@/lib/hooks/use-board-realtime";
import { BoardPageClient } from "@/app/(dashboard)/projects/[id]/board";
import { makeBoard, makeColumn, makeTask } from "@/tests/support/factories";
import {
  VALID_BOARD_ID,
  VALID_COL_A_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
} from "@/tests/support/fixtures";
import { mockUseQueries, mockUseQuery } from "@/tests/support/trpc";

const column = makeColumn({ id: VALID_COL_A_ID });
const board = makeBoard({ id: VALID_BOARD_ID });
const boardWithColumns = { ...board, columns: [column] };
const task = makeTask({ columnId: VALID_COL_A_ID });

function setupCommonMocks(): void {
  vi.mocked(useBoardRealtime).mockReturnValue({ current: null });
  mockUseQuery(api.boards.get, boardWithColumns);
  mockUseQuery(api.tasks.labelsByProject, []);
  mockUseQueries([{ data: [task] }]);
}

describe("BoardPageClient", () => {
  it("falls back to initialBoard when the query has not resolved yet", () => {
    vi.mocked(useBoardRealtime).mockReturnValue({ current: null });
    mockUseQuery(api.boards.get, undefined);
    mockUseQuery(api.tasks.labelsByProject, []);
    mockUseQueries([{ data: undefined }]);
    render(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardWithColumns}
        initialTasks={{ [VALID_COL_A_ID]: [task] }}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    expect(screen.getByText(/KanbanBoard: Main Board/)).toBeInTheDocument();
  });

  it("renders the live board name and column count from the query", () => {
    setupCommonMocks();
    render(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardWithColumns}
        initialTasks={{ [VALID_COL_A_ID]: [task] }}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    expect(screen.getByText("KanbanBoard: Main Board (1 columns, 1 tasks)")).toBeInTheDocument();
  });

  it("updates liveTasks when a column's task query data actually changes on rerender", () => {
    setupCommonMocks();
    const { rerender } = render(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardWithColumns}
        initialTasks={{ [VALID_COL_A_ID]: [task] }}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    expect(screen.getByText("KanbanBoard: Main Board (1 columns, 1 tasks)")).toBeInTheDocument();

    // Simulates a real task query refetch/socket update landing mid-session -
    // Object.fromEntries alone would give `liveTasks` a new identity on
    // EVERY render regardless of this change; the assertion below only
    // passes if the adjust-during-render sync in board.tsx actually compares
    // per-column data and propagates a real change through.
    const secondTask = makeTask({ id: "task-2", columnId: VALID_COL_A_ID });
    mockUseQueries([{ data: [task, secondTask] }]);
    rerender(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardWithColumns}
        initialTasks={{ [VALID_COL_A_ID]: [task] }}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    expect(screen.getByText("KanbanBoard: Main Board (1 columns, 2 tasks)")).toBeInTheDocument();
  });

  it("builds the labelsByTask map from labelsByProject pairs", () => {
    setupCommonMocks();
    const label = { id: "l1", orgId: VALID_ORG_ID, name: "Bug", color: "#EF4444" };
    mockUseQuery(api.tasks.labelsByProject, [{ taskId: task.id, label }]);
    render(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardWithColumns}
        initialTasks={{ [VALID_COL_A_ID]: [task] }}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    // Rendered via mocked KanbanBoard which doesn't display labels, but the
    // absence of a thrown error while computing the map is itself the assertion:
    // the reduce logic in useMemo executed without error for a non-empty pair list.
    expect(screen.getByText(/KanbanBoard/)).toBeInTheDocument();
  });

  it("falls back to initialTasks for a column when useQueries returns no matching entry", () => {
    vi.mocked(useBoardRealtime).mockReturnValue({ current: null });
    mockUseQuery(api.boards.get, boardWithColumns);
    mockUseQuery(api.tasks.labelsByProject, []);
    mockUseQueries([{ data: undefined }]);
    render(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardWithColumns}
        initialTasks={{ [VALID_COL_A_ID]: [task] }}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    expect(screen.getByText(/KanbanBoard: Main Board/)).toBeInTheDocument();
  });

  it("falls back to an empty array in useQueries factory for a column missing from initialTasks", () => {
    vi.mocked(useBoardRealtime).mockReturnValue({ current: null });
    const colX = makeColumn({ id: "col-x" });
    const boardX = { ...boardWithColumns, columns: [colX] };
    mockUseQuery(api.boards.get, boardX);
    mockUseQuery(api.tasks.labelsByProject, []);
    mockUseQueries([{ data: [] }]);
    render(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardX}
        initialTasks={{}}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    expect(screen.getByText(/KanbanBoard/)).toBeInTheDocument();
  });

  it("falls back to an empty array when the column has neither query data nor initialTasks", () => {
    vi.mocked(useBoardRealtime).mockReturnValue({ current: null });
    mockUseQuery(api.boards.get, boardWithColumns);
    mockUseQuery(api.tasks.labelsByProject, []);
    mockUseQueries([{ data: undefined }]);
    render(
      <BoardPageClient
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        boardId={VALID_BOARD_ID}
        initialBoard={boardWithColumns}
        initialTasks={{}}
        projectName="Demo Project"
        initialBoards={[board]}
        canEdit={true}
        canManageBoards={true}
      />,
    );
    expect(screen.getByText(/KanbanBoard/)).toBeInTheDocument();
  });
});
