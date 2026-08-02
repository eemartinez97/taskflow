import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { CreateBoardDialog } from "@/app/(dashboard)/projects/[id]/_components/create-board-dialog";
import { setupRouterMock } from "@/tests/support/render";
import { mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";
import { VALID_ORG_ID, VALID_PROJECT_ID } from "@/tests/support/fixtures";

describe("CreateBoardDialog", () => {
  it("submits create with orgId and { projectId, name }", async () => {
    setupRouterMock();
    const { mutateMock } = setupMutationMock(api.boards.create);
    render(
      <CreateBoardDialog
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        open
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Sprint 2");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      data: { projectId: VALID_PROJECT_ID, name: "Sprint 2" },
    });
  });

  it("shows a success toast and closes on success", () => {
    setupRouterMock();
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.boards.create);
    render(
      <CreateBoardDialog
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        open
        onClose={onClose}
      />,
    );

    act(() => {
      triggerSuccess({ id: "board-2" });
    });

    expect(toast.success).toHaveBeenCalledWith("Board created.");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation error inline", () => {
    setupRouterMock();
    mockUseMutationResult(api.boards.create, {
      isError: true,
      error: new Error("Board name required."),
    });
    render(
      <CreateBoardDialog
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        open
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Board name required.")).toBeInTheDocument();
  });
});
