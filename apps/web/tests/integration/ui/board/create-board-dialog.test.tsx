import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CreateBoardDialog } from "@/app/(dashboard)/projects/[id]/_components/create-board-dialog";
import { api } from "@/lib/trpc/client";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { toast } from "@/lib/toast/store";

// -- Fixtures --
const ORG_ID = "org-1";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_NEW_BOARD = { id: "board-new-1", name: "Sprint 2", projectId: PROJECT_ID };

// -- Helpers --
const mockOnClose = vi.fn();

let mockInvalidateBoardsList: ReturnType<typeof vi.fn>;
let createMutation: ReturnType<typeof wireCapturableMutation>;

function buildProps(overrides: { open?: boolean } = {}) {
  return {
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    open: true,
    onClose: mockOnClose,
    ...overrides,
  };
}

// -- Tests --
describe("CreateBoardDialog", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    mockOnClose.mockReset();

    mockInvalidateBoardsList = vi.fn();
    mockApiUtils({ boards: { list: { invalidate: mockInvalidateBoardsList } } });
    createMutation = wireCapturableMutation(api.boards.create);
  });

  // -- Rendering --

  it("does not render when open is false", () => {
    renderUI(<CreateBoardDialog {...buildProps({ open: false })} />);

    expect(screen.queryByText("Create board")).not.toBeInTheDocument();
  });

  it("renders the dialog title when open is true", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    expect(screen.getByText("Create board")).toBeInTheDocument();
  });

  it("renders an empty Name field on open", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("renders Create and Cancel footer buttons", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // -- Form submission --

  it("calls mutation.mutate with orgId, projectId and board name on submit", async () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Sprint 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(createMutation.mutate).toHaveBeenCalledWith({
        orgId: ORG_ID,
        data: expect.objectContaining({ name: "Sprint 2", projectId: PROJECT_ID }) as unknown,
      });
    });
  });

  it("shows a validation error and does NOT call mutate when name is empty", async () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Success side effects --

  it("shows a success toast on mutation success", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_NEW_BOARD);
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Board created.");
  });

  it("invalidates boards.list on mutation success", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_NEW_BOARD);
    });

    expect(mockInvalidateBoardsList).toHaveBeenCalledWith({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
    });
  });

  it("calls onClose on mutation success", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_NEW_BOARD);
    });

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("navigates to the new board URL on mutation success", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);

    act(() => {
      createMutation.simulateSuccess(MOCK_NEW_BOARD);
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}?board=${MOCK_NEW_BOARD.id}`,
    );
  });

  // -- Error display --

  it("shows the inline error alert when the mutation is in error state", () => {
    const errorText = "Board name already in use.";
    mockMutationError(api.boards.create, createMutation, errorText);
    renderUI(<CreateBoardDialog {...buildProps()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  it("does NOT render an alert when there is no mutation error", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -- Cancel behavior --

  it("calls onClose when Cancel is clicked", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("resets the mutation state when Cancel is clicked", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(createMutation.reset).toHaveBeenCalledOnce();
  });

  it("does NOT navigate when Cancel is clicked", () => {
    renderUI(<CreateBoardDialog {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
