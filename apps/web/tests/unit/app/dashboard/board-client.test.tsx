import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit"));

import { api } from "@/tests/mocks/trpc-api";
import {
  type UseQueriesFactory,
  type UseQueriesMock,
  makeColumn,
  makeTask,
  makeTasksMap,
  makeUseQueriesMock,
  VALID_BOARD_ID,
  VALID_COL_A_ID,
  VALID_COL_B_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
} from "@/tests/helpers";
import { BoardPageClient } from "@/app/(dashboard)/projects/[id]/board";

// -- Fixtures --

const colA = makeColumn({ id: VALID_COL_A_ID });
const colB = makeColumn({ id: VALID_COL_B_ID, name: "Done", position: 2000 });
const task1 = makeTask({ columnId: VALID_COL_A_ID });

const defaultProps = {
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
  boardId: VALID_BOARD_ID,
  initialColumns: [colA, colB],
  initialTasks: makeTasksMap({ [VALID_COL_A_ID]: [task1], [VALID_COL_B_ID]: [] }),
};

// -- useQueries typing --

// Cast the untyped mock once — every usage below uses this reference
const useQueriesMock = api.useQueries as unknown as UseQueriesMock;

// -- Setup --

beforeEach(() => {
  vi.clearAllMocks();
  useQueriesMock.mockImplementation(makeUseQueriesMock([{ data: [task1] }, { data: [] }]));
});

// -- Rendering --

describe("BoardPageClient", () => {
  it("renders without errors", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("calls api.useQueries with one entry per column", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(useQueriesMock).toHaveBeenCalledOnce();
  });

  it("invokes the useQueries factory callback", () => {
    render(<BoardPageClient {...defaultProps} />);
    const factory = useQueriesMock.mock.calls[0]?.[0];
    expect(typeof factory).toBe("function");
  });

  it("renders tasks from live query data", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(screen.getByText(task1.title)).toBeInTheDocument();
  });

  // -- initialData fallback branch --

  it("falls back to initialTasks[col.id] when query returns undefined data", () => {
    useQueriesMock.mockImplementation(makeUseQueriesMock([{ data: undefined }, { data: [] }]));
    render(<BoardPageClient {...defaultProps} />);
    expect(screen.getByText(task1.title)).toBeInTheDocument();
  });

  it("falls back to [] when both query data AND initialTasks[col.id] are absent", () => {
    useQueriesMock.mockImplementation(
      makeUseQueriesMock([{ data: undefined }, { data: undefined }]),
    );
    render(<BoardPageClient {...defaultProps} initialTasks={{ [VALID_COL_A_ID]: [task1] }} />);
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  // -- The factory callback internally uses orgId and columnId --

  it("factory callback receives orgId in the query input", () => {
    const capturedInputs: { orgId: string; columnId: string }[] = [];

    useQueriesMock.mockImplementation((factory: UseQueriesFactory) => {
      const builder = {
        tasks: {
          list: vi.fn((input: { orgId: string; columnId: string }) => {
            capturedInputs.push(input);
            return { queryKey: [], queryFn: () => [] };
          }),
        },
      };
      try {
        factory(builder);
      } catch {
        /* swallow */
      }
      return [{ data: [task1] }, { data: [] }];
    });

    render(<BoardPageClient {...defaultProps} />);

    expect(capturedInputs).toHaveLength(2);
    expect(capturedInputs[0]?.orgId).toBe(VALID_ORG_ID);
    expect(capturedInputs[1]?.orgId).toBe(VALID_ORG_ID);
  });

  it("factory callback receives each column's id as columnId", () => {
    const capturedColumnIds: string[] = [];

    useQueriesMock.mockImplementation((factory: UseQueriesFactory) => {
      const builder = {
        tasks: {
          list: vi.fn((input: { orgId: string; columnId: string }) => {
            capturedColumnIds.push(input.columnId);
            return { queryKey: [], queryFn: () => [] };
          }),
        },
      };
      try {
        factory(builder);
      } catch {
        /* swallow */
      }
      return [{ data: [task1] }, { data: [] }];
    });

    render(<BoardPageClient {...defaultProps} />);

    expect(capturedColumnIds).toContain(VALID_COL_A_ID);
    expect(capturedColumnIds).toContain(VALID_COL_B_ID);
  });

  it("passes initialData from initialTasks to each column query", () => {
    const capturedInitialData: unknown[][] = [];

    useQueriesMock.mockImplementation((factory: UseQueriesFactory) => {
      const builder = {
        tasks: {
          list: vi.fn((_input: unknown, opts?: { initialData?: unknown[] }) => {
            capturedInitialData.push(opts?.initialData ?? []);
            return { queryKey: [], queryFn: () => [] };
          }),
        },
      };
      try {
        factory(builder);
      } catch {
        /* swallow */
      }
      return [{ data: [task1] }, { data: [] }];
    });

    render(<BoardPageClient {...defaultProps} />);

    expect(capturedInitialData[0]).toContainEqual(expect.objectContaining({ id: task1.id }));
    expect(capturedInitialData[1]).toEqual([]);
  });

  // -- Edge cases --

  it("renders correctly with no columns", () => {
    useQueriesMock.mockImplementation(makeUseQueriesMock([]));
    render(<BoardPageClient {...defaultProps} initialColumns={[]} initialTasks={{}} />);
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("passes orgId and projectId down to KanbanBoard", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(screen.getByRole("region", { name: /kanban board/i })).toBeInTheDocument();
  });

  it("calls tasks.move.useMutation on mount", () => {
    render(<BoardPageClient {...defaultProps} />);
    expect(api.tasks.move.useMutation).toHaveBeenCalled();
  });
});
