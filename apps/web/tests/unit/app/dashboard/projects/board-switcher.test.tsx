import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { api } from "@/lib/trpc/client";
import { BoardSwitcher } from "@/app/(dashboard)/projects/[id]/_components/board-switcher";
import { makeBoard } from "@/tests/support/factories";
import { mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { VALID_ORG_ID, VALID_PROJECT_ID } from "@/tests/support/fixtures";

const boardA = makeBoard({ id: "board-a", name: "Board A" });
const boardB = makeBoard({ id: "board-b", name: "Board B" });

describe("BoardSwitcher", () => {
  it("navigates to the selected board on change", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    const { pushMock } = setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canManage
      />,
    );
    await userEvent.setup().selectOptions(screen.getByLabelText(/select board/i), boardB.id);
    expect(pushMock).toHaveBeenCalledWith(`/projects/${VALID_PROJECT_ID}?board=${boardB.id}`);
  });

  it("hides delete when canManage is false", () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canManage={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /delete current board/i })).not.toBeInTheDocument();
  });

  it("hides delete when there is only one board (even for managers)", () => {
    mockUseQuery(api.boards.list, [boardA]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA]}
        canManage
      />,
    );
    expect(screen.queryByRole("button", { name: /delete current board/i })).not.toBeInTheDocument();
  });

  it("opens the create board dialog", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA]}
        canManage
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /create board/i }));
    expect(screen.getByText("Create board")).toBeInTheDocument();
  });

  it("deletes the active board and navigates to the next remaining one", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    const { pushMock, refreshMock } = setupRouterMock();
    const { mutateMock, triggerSuccess } = setupMutationMock(api.boards.delete);
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canManage
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /delete current board/i }));
    await user.type(screen.getByLabelText(/type/i), "Board A");
    await user.click(screen.getByRole("button", { name: "Delete board" }));
    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, boardId: boardA.id });

    act(() => {
      triggerSuccess();
    });

    expect(pushMock).toHaveBeenCalledWith(`/projects/${VALID_PROJECT_ID}?board=${boardB.id}`);
    expect(refreshMock).toHaveBeenCalled();
  });

  it("navigates to the bare project route when no other board remains after delete", () => {
    mockUseQuery(api.boards.list, [boardA]);
    const { pushMock } = setupRouterMock();
    const { triggerSuccess } = setupMutationMock(api.boards.delete);

    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA]}
        canManage
      />,
    );
    // Only one board => delete button hidden; simulate the mutation's onSuccess directly.
    triggerSuccess();
    expect(pushMock).toHaveBeenCalledWith(`/projects/${VALID_PROJECT_ID}`);
  });

  it("uses an empty pending name when activeBoardId matches no known board", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId="non-existent-board"
        initialBoards={[boardA, boardB]}
        canManage
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /delete current board/i }));
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
  });
});
