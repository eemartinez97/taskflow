import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import type { Board } from "@taskflow/database";
import { BoardSwitcher } from "@/components/kanban/board-switcher";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { makeBoard } from "@/tests/support/factories";

// -- Module mocks --

vi.mock("@/components/kanban/create-board-dialog", () => ({
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
    canCreate: true,
    canManage: true,
    ...overrides,
  };
}

function openMenu(): void {
  fireEvent.click(screen.getByRole("button", { name: /switch board/i }));
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

  it("lists every board name as a menu item once the menu is opened", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    openMenu();

    expect(screen.getByRole("menuitem", { name: /^Sprint 1/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sprint 2" })).toBeInTheDocument();
  });

  it("marks the active board with a checkmark", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    openMenu();

    expect(screen.getByRole("menuitem", { name: /^Sprint 1/ }).querySelector("svg")).not.toBeNull();
  });

  it("does not render a menu until opened", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  // -- Board switching --

  it("navigates to the clicked board's URL", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sprint 2" }));

    expect(mockRouter.push).toHaveBeenCalledWith(`/projects/${PROJECT_ID}?board=${BOARD_B.id}`);
  });

  // -- Delete visibility --

  it("shows the delete item when canManage=true and more than one board exists", () => {
    renderUI(<BoardSwitcher {...buildProps({ canManage: true })} />);

    openMenu();

    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("hides the delete item when canManage=false", () => {
    renderUI(<BoardSwitcher {...buildProps({ canManage: false })} />);

    openMenu();

    expect(screen.queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("hides the delete item when only one board exists", () => {
    setupBoardsQuery([BOARD_A]);
    renderUI(<BoardSwitcher {...buildProps({ initialBoards: [BOARD_A] })} />);

    openMenu();

    expect(screen.queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
  });

  // -- Create board dialog --

  it("opens CreateBoardDialog when 'New board' is clicked", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /new board/i }));

    expect(screen.getByTestId("create-board-dialog")).toBeInTheDocument();
  });

  it("closes CreateBoardDialog when its close handler fires", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /new board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close create" }));

    expect(screen.queryByTestId("create-board-dialog")).not.toBeInTheDocument();
  });

  // -- Delete flow --

  it("opens ConfirmDialog with the active board name when the delete item is clicked", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete board")).toBeInTheDocument();
  });

  it("calls deleteMutation.mutate with orgId and activeBoardId when confirmed", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({
      orgId: ORG_ID,
      boardId: BOARD_A.id,
    });
  });

  it("closes ConfirmDialog without calling mutate when Cancel is clicked", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    expect(deleteMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a success toast after a successful board deletion", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Board deleted.");
  });

  it("invalidates boards.list after a successful deletion", () => {
    renderUI(<BoardSwitcher {...buildProps()} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
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
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(mockRouter.push).toHaveBeenCalledWith(`/projects/${PROJECT_ID}?board=${BOARD_B.id}`);
  });
});
