import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities"));
vi.mock("socket.io-client", () => import("@/tests/mocks/socket-io-client"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit"));

import { SOCKET_EVENTS } from "@taskflow/shared";

import {
  type UseQueriesMock,
  makeUseQueriesMock,
  makeTRPCUtilsMock,
  VALID_PROJECT_ID,
  VALID_BOARD_ID,
  VALID_COL_A_ID,
  VALID_COL_B_ID,
  makeTasksMap,
  toSocketTask,
  VALID_ORG_ID,
  makeColumn,
  makeTask,
} from "@/tests/helpers";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";
import { BoardPageClient } from "@/app/(dashboard)/projects/[id]/board";
import { api } from "@/tests/mocks/trpc-api";

// -- Fixtures --

const colA = makeColumn({ id: VALID_COL_A_ID });
const colB = makeColumn({ id: VALID_COL_B_ID, name: "Done", position: 2000 });
const task1 = makeTask({ id: "t1", columnId: VALID_COL_A_ID, title: "Task One" });
const socketTask1 = toSocketTask(task1);

const defaultProps = {
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
  boardId: VALID_BOARD_ID,
  initialColumns: [colA, colB],
  initialTasks: makeTasksMap({ [VALID_COL_A_ID]: [task1], [VALID_COL_B_ID]: [] }),
};

const useQueriesMock = api.useQueries as unknown as UseQueriesMock;

// -- Setup --

beforeEach(() => {
  resetHandlerStore();
  vi.clearAllMocks();

  useQueriesMock.mockImplementation(makeUseQueriesMock([{ data: [task1] }, { data: [] }]));

  vi.mocked(api.useUtils).mockReturnValue(
    makeTRPCUtilsMock({ [VALID_COL_A_ID]: [socketTask1], [VALID_COL_B_ID]: [] }) as never,
  );
  vi.mocked(api.tasks.move.useMutation).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
  });
});

// -- Tests --

describe("BoardPageClient — real-time integration", () => {
  it("renders without errors", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("calls socket.connect() when the component mounts", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(mockSocket.connect).toHaveBeenCalledOnce();
  });

  it("registers the four task event handlers", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_CREATED, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_UPDATED, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_MOVED, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_DELETED, expect.any(Function));
  });

  it("updates the TanStack Query cache on task:created event", () => {
    const utils = makeTRPCUtilsMock({ [VALID_COL_A_ID]: [], [VALID_COL_B_ID]: [] });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    render(<BoardPageClient {...defaultProps} />);
    triggerSocketEvent(SOCKET_EVENTS.TASK_CREATED, { task: socketTask1 });

    expect(utils.tasks.list.setData).toHaveBeenCalledWith(
      { orgId: VALID_ORG_ID, columnId: VALID_COL_A_ID },
      expect.any(Function),
    );
  });

  it("updates the cache on task:deleted event for every column", () => {
    const utils = makeTRPCUtilsMock({
      [VALID_COL_A_ID]: [socketTask1],
      [VALID_COL_B_ID]: [],
    });
    vi.mocked(api.useUtils).mockReturnValue(utils as never);

    render(<BoardPageClient {...defaultProps} />);
    triggerSocketEvent(SOCKET_EVENTS.TASK_DELETED, { taskId: socketTask1.id });

    const setCalls = vi.mocked(utils.tasks.list.setData).mock.calls as [
      { columnId: string },
      unknown,
    ][];
    const updatedCols = setCalls.map(([{ columnId }]) => columnId);
    expect(updatedCols).toContain(VALID_COL_A_ID);
    expect(updatedCols).toContain(VALID_COL_B_ID);
  });
});
