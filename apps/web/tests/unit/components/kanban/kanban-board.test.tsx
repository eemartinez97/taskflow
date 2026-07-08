import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities.js"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api.js"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit.js"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui.js"));
vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit.js"));

import { KanbanBoard } from "@/components/kanban/kanban-board";
import { api } from "@/tests/mocks/trpc-api";
import {
  makeColumn,
  makeTask,
  makeTasksMap,
  VALID_COL_A_ID,
  VALID_COL_B_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_1_ID,
} from "@/tests/helpers";

const colA = makeColumn();
const colB = makeColumn({ id: VALID_COL_B_ID, name: "Done", position: 2000 });
const task1 = makeTask({ id: VALID_TASK_1_ID, title: "Build auth", columnId: VALID_COL_A_ID });

const defaultProps = {
  orgId: VALID_ORG_ID,
  projectId: VALID_PROJECT_ID,
  columns: [colA, colB],
  initialTasks: makeTasksMap({ [VALID_COL_A_ID]: [task1], [VALID_COL_B_ID]: [] }),
};

describe("KanbanBoard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the board container", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("has accessible role=region label", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByRole("region", { name: /kanban board/i })).toBeInTheDocument();
  });

  it("renders all columns", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByTestId(`column-${VALID_COL_A_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`column-${VALID_COL_B_ID}`)).toBeInTheDocument();
  });

  it("renders the column names", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders a task card in its initial column", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByText("Build auth")).toBeInTheDocument();
  });

  it("renders the drag overlay container", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(screen.getByTestId("drag-overlay")).toBeInTheDocument();
  });

  it("renders correctly with zero tasks in all columns", () => {
    render(
      <KanbanBoard
        {...defaultProps}
        initialTasks={{ [VALID_COL_A_ID]: [], [VALID_COL_B_ID]: [] }}
      />,
    );
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("renders correctly with no columns", () => {
    render(<KanbanBoard {...defaultProps} columns={[]} initialTasks={{}} />);
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("calls tasks.move.useMutation on mount", () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(api.tasks.move.useMutation).toHaveBeenCalled();
  });
});
