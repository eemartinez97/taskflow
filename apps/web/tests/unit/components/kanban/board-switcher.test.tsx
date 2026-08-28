import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { api } from "@/lib/trpc/client";
import { BoardSwitcher } from "@/components/kanban/board-switcher";
import { makeBoard } from "@/tests/support/factories";
import { mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { VALID_ORG_ID, VALID_PROJECT_ID } from "@/tests/support/fixtures";

const boardA = makeBoard({ id: "board-a", name: "Board A" });
const boardB = makeBoard({ id: "board-b", name: "Board B" });

async function openMenu(): Promise<void> {
  await userEvent.setup().click(screen.getByRole("button", { name: /switch board/i }));
}

describe("BoardSwitcher", () => {
  it("navigates to the selected board on click", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    const { pushMock } = setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canCreate
        canManage
      />,
    );
    await openMenu();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: "Board B" }));
    expect(pushMock).toHaveBeenCalledWith(`/projects/${VALID_PROJECT_ID}?board=${boardB.id}`);
  });

  it("does not navigate when clicking the already-active board", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    const { pushMock } = setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canCreate
        canManage
      />,
    );
    await openMenu();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: /^Board A/ }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("hides new board when canCreate is false (VIEWER)", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canCreate={false}
        canManage={false}
      />,
    );
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /new board/i })).not.toBeInTheDocument();
  });

  it("hides delete when canManage is false", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canCreate
        canManage={false}
      />,
    );
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("hides delete when there is only one board (even for managers)", async () => {
    mockUseQuery(api.boards.list, [boardA]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA]}
        canCreate
        canManage
      />,
    );
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /delete/i })).not.toBeInTheDocument();
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
        canCreate
        canManage
      />,
    );
    await openMenu();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: /new board/i }));
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
        canCreate
        canManage
      />,
    );
    const user = userEvent.setup();
    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: /delete current board/i }));
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
        canCreate
        canManage
      />,
    );
    // Only one board => delete control hidden; simulate the mutation's onSuccess directly.
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
        canCreate
        canManage
      />,
    );
    await openMenu();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
  });

  it("closes the menu on outside click and on Escape", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    setupRouterMock();
    render(
      <div>
        <BoardSwitcher
          orgId={VALID_ORG_ID}
          projectId={VALID_PROJECT_ID}
          activeBoardId={boardA.id}
          initialBoards={[boardA, boardB]}
          canCreate
          canManage
        />
        <button type="button">outside</button>
      </div>,
    );
    const user = userEvent.setup();
    await openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await openMenu();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("stays open when a non-Escape key is pressed", async () => {
    mockUseQuery(api.boards.list, [boardA, boardB]);
    setupRouterMock();
    render(
      <BoardSwitcher
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        activeBoardId={boardA.id}
        initialBoards={[boardA, boardB]}
        canCreate
        canManage
      />,
    );
    const user = userEvent.setup();
    await openMenu();
    await user.keyboard("{a}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
