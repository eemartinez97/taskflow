import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import type { Board } from "@taskflow/database";
import { BoardSwitcher } from "@/app/(dashboard)/projects/[id]/_components/board-switcher";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { makeBoard } from "@/tests/support/factories";

// -- Module mocks --

vi.mock("@/app/(dashboard)/projects/[id]/_components/create-board-dialog", () => ({
  CreateBoardDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="create-board-dialog">
        <button onClick={onClose}>Close create</button>
      </div>
    ) : null,
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

// -- Fixtures --
const BOARD_A = makeBoard({ id: "board-1", name: "Sprint 1", projectId: "proj-1" });
const BOARD_B = makeBoard({ id: "board-2", name: "Sprint 2", projectId: "proj-1" });
const PROJECT_ID = "proj-1";
const ORG_ID = "org-1";

// -- Helpers --

let mockInvalidateBoardsList: ReturnType<typeof vi.fn>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;

function setupBoardsQuery(boards: Board[]): void {
  mockUseQuery(api.boards.list, boards);
}

function buildProps(overrides: Partial<Parameters<typeof BoardSwitcher>[0]> = {}) {
  return {
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    activeBoardId: BOARD_A.id,
    initialBoards: [BOARD_A, BOARD_B],
    canManage: true,
    ...overrides,
  };
}

// -- Tests --
describe("BoardSwitcher", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    mockInvalidateBoardsList = vi.fn();
    mockApiUtils({ boards: { list: { invalidate: mockInvalidateBoardsList } } });
    deleteMutation = wireCapturableMutation(api.boards.delete);
    setupBoardsQuery([BOARD_A, BOARD_B]);
  });

  // -- Rendering --

  it("renders all board names as select options", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    expect(screen.getByRole("option", { name: "Sprint 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sprint 2" })).toBeInTheDocument();
  });

  it("selects the activeBoardId in the select", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    expect(screen.getByRole("combobox")).toHaveValue(BOARD_A.id);
  });

  it("renders the 'New board' button", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Create board" })).toBeInTheDocument();
  });

  // -- Board switching --

  it("navigates to the selected board URL when the select changes", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: BOARD_B.id } });

    expect(mockRouter.push).toHaveBeenCalledWith(`/projects/${PROJECT_ID}?board=${BOARD_B.id}`);
  });

  // -- Delete button visibility --

  it("shows the Delete button when canManage=true and more than one board exists", () => {
    renderUI(<BoardSwitcher {...buildProps({ canManage: true })} />);

    expect(screen.getByRole("button", { name: /delete current board/i })).toBeInTheDocument();
  });

  it("hides the Delete button when canManage=false", () => {
    renderUI(<BoardSwitcher {...buildProps({ canManage: false })} />);

    expect(screen.queryByRole("button", { name: /delete current board/i })).not.toBeInTheDocument();
  });

  it("hides the Delete button when only one board exists", () => {
    setupBoardsQuery([BOARD_A]);
    renderUI(<BoardSwitcher {...buildProps({ initialBoards: [BOARD_A] })} />);

    expect(screen.queryByRole("button", { name: /delete current board/i })).not.toBeInTheDocument();
  });

  // -- Create board dialog --

  it("opens CreateBoardDialog when 'New board' is clicked", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create board" }));

    expect(screen.getByTestId("create-board-dialog")).toBeInTheDocument();
  });

  it("closes CreateBoardDialog when its close handler fires", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create board" }));
    fireEvent.click(screen.getByRole("button", { name: "Close create" }));

    expect(screen.queryByTestId("create-board-dialog")).not.toBeInTheDocument();
  });

  // -- Delete flow --

  it("opens ConfirmDialog with the active board name when Delete is clicked", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete current board/i }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete board")).toBeInTheDocument();
  });

  it("calls deleteMutation.mutate with orgId and activeBoardId when confirmed", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete current board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({
      orgId: ORG_ID,
      boardId: BOARD_A.id,
    });
  });

  it("closes ConfirmDialog without calling mutate when Cancel is clicked", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete current board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    expect(deleteMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a success toast after a successful board deletion", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete current board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Board deleted.");
  });

  it("invalidates boards.list after a successful deletion", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete current board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(mockInvalidateBoardsList).toHaveBeenCalledWith({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
    });
  });

  it("navigates to the next remaining board after a successful deletion", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete current board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(mockRouter.push).toHaveBeenCalledWith(`/projects/${PROJECT_ID}?board=${BOARD_B.id}`);
  });
});
