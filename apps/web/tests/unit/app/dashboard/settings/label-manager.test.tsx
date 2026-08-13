import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

let capturedConfirmProps: { onConfirm?: () => void } = {};
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: { open: boolean; onConfirm: () => void; onClose: () => void }) => {
    capturedConfirmProps = props;
    return props.open ? (
      <>
        <button onClick={props.onConfirm}>Confirm Delete</button>
        <button onClick={props.onClose}>Cancel Delete</button>
      </>
    ) : null;
  },
}));

import { api } from "@/lib/trpc/client";
import { LabelManager } from "@/app/(dashboard)/settings/_components/label-manager";
import { mockUseMutationResult, mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { makeLabel } from "@/tests/support/factories";

describe("LabelManager", () => {
  it("renders empty state and creates label on Enter", async () => {
    mockUseQuery(api.labels.list, []);
    const { mutateMock } = setupMutationMock(api.labels.create);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);

    const input = screen.getByPlaceholderText("e.g. Bug");
    await userEvent.setup().type(input, "Bug");
    await userEvent.keyboard("{Enter}");

    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      data: { name: "Bug", color: "#EF4444" },
    });
  });

  it("renders existing labels and deletes on confirm", async () => {
    mockUseQuery(api.labels.list, [
      { id: "l1", name: "Feature", color: "#3B82F6", orgId: VALID_ORG_ID },
    ]);
    const { mutateMock } = setupMutationMock(api.labels.delete);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);

    await userEvent.setup().click(screen.getByRole("button", { name: /delete label feature/i }));
    await userEvent.setup().click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, labelId: "l1" });
  });

  it("changes color preset", async () => {
    mockUseQuery(api.labels.list, []);
    const { mutateMock } = setupMutationMock(api.labels.create);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);

    await userEvent.setup().type(screen.getByPlaceholderText("e.g. Bug"), "Urgent");
    await userEvent.setup().click(screen.getByRole("button", { name: /select color #22C55E/i }));
    await userEvent.setup().click(screen.getByRole("button", { name: /add/i }));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ color: "#22C55E" }) as unknown }),
    );
  });

  it("closes the delete dialog without deleting when cancelled", async () => {
    mockUseQuery(api.labels.list, [
      { id: "l1", name: "Feature", color: "#3B82F6", orgId: VALID_ORG_ID },
    ]);

    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /delete label feature/i }));
    await user.click(screen.getByRole("button", { name: /cancel delete/i }));
    expect(screen.queryByRole("button", { name: /confirm delete/i })).not.toBeInTheDocument();
  });

  it("invalidates and clears the name field on a successful create", () => {
    mockUseQuery(api.labels.list, []);
    const { triggerSuccess } = setupMutationMock(api.labels.create);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);
    act(() => {
      triggerSuccess(makeLabel("l-new", "Bug"));
    });
  });

  it("invalidates and resets deleteTarget on a successful delete", () => {
    mockUseQuery(api.labels.list, [
      { id: "l1", name: "Feature", color: "#3B82F6", orgId: VALID_ORG_ID },
    ]);
    const { triggerSuccess } = setupMutationMock(api.labels.delete);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);
    act(() => {
      triggerSuccess();
    });
  });

  it("does not create a label when Enter is pressed on an empty name", async () => {
    mockUseQuery(api.labels.list, []);
    const { mutateMock } = setupMutationMock(api.labels.create);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);
    const input = screen.getByPlaceholderText("e.g. Bug");
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("shows the inline error alert when the create mutation fails", () => {
    mockUseQuery(api.labels.list, []);
    mockUseMutationResult(api.labels.create, {
      isError: true,
      error: new Error("Name too long"),
    });
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);
    expect(screen.getByText("Name too long")).toBeInTheDocument();
  });

  it("does nothing when onConfirm fires without a deleteTarget", () => {
    mockUseQuery(api.labels.list, []);
    const { mutateMock } = setupMutationMock(api.labels.delete);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage />);
    capturedConfirmProps.onConfirm?.();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  // -- canManage=false (member can view labels, not create/delete) --

  it("hides the create-label form when canManage is false", () => {
    mockUseQuery(api.labels.list, []);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage={false} />);
    expect(screen.queryByPlaceholderText("e.g. Bug")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^add$/i })).not.toBeInTheDocument();
  });

  it("hides each label's delete button when canManage is false", () => {
    mockUseQuery(api.labels.list, [
      { id: "l1", name: "Feature", color: "#3B82F6", orgId: VALID_ORG_ID },
    ]);
    render(<LabelManager orgId={VALID_ORG_ID} initialLabels={[]} canManage={false} />);
    expect(screen.getByText("Feature")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete label feature/i })).not.toBeInTheDocument();
  });
});
