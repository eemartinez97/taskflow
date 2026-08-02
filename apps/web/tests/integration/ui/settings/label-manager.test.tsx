import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Label } from "@taskflow/database";
import { LabelManager } from "@/app/(dashboard)/settings/_components/label-manager";
import { api } from "@/lib/trpc/client";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation, mockMutationError } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { makeLabel } from "@/tests/support/factories";

// -- Module mocks --

vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onClose,
    description,
  }: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    description: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{description}</p>
        <button onClick={onConfirm}>Confirm delete</button>
        <button onClick={onClose}>Cancel delete</button>
      </div>
    ) : null,
}));

// -- Fixtures --
const ORG_ID = "org-1";
const PRESET_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
] as const;

const LABEL_BUG = makeLabel("l-bug", "Bug", { color: "#EF4444" });
const LABEL_URGENT = makeLabel("l-urgent", "Urgent", { color: "#F97316" });

// -- Helpers --
let mockInvalidateLabels: ReturnType<typeof vi.fn>;
let createMutation: ReturnType<typeof wireCapturableMutation>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;

function setupLabelsQuery(labels: Label[]): void {
  mockUseQuery(api.labels.list, labels);
}

// -- Tests --
describe("LabelManager", () => {
  beforeEach(() => {
    mockInvalidateLabels = vi.fn();
    mockApiUtils({ labels: { list: { invalidate: mockInvalidateLabels } } });
    createMutation = wireCapturableMutation(api.labels.create);
    deleteMutation = wireCapturableMutation(api.labels.delete);
    setupLabelsQuery([]);
  });

  // -- Rendering --

  it("renders the 'Labels' card heading", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    expect(screen.getByText("Labels")).toBeInTheDocument();
  });

  it("renders 'No labels yet.' when the labels list is empty", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    expect(screen.getByText("No labels yet.")).toBeInTheDocument();
  });

  it("renders a chip for each existing label", () => {
    setupLabelsQuery([LABEL_BUG, LABEL_URGENT]);
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[LABEL_BUG, LABEL_URGENT]} />);

    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("renders a delete button for each existing label chip", () => {
    setupLabelsQuery([LABEL_BUG, LABEL_URGENT]);
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[LABEL_BUG, LABEL_URGENT]} />);

    expect(screen.getByRole("button", { name: "Delete label Bug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete label Urgent" })).toBeInTheDocument();
  });

  // -- Label name input --

  it("renders the label name input with placeholder 'e.g. Bug'", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    expect(screen.getByPlaceholderText("e.g. Bug")).toBeInTheDocument();
  });

  it("disables the Add button when the name input is empty", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("enables the Add button when the name input has content", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Bug"), {
      target: { value: "Performance" },
    });

    expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
  });

  // -- Color picker --

  it("renders 7 color preset buttons", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    const colorButtons = PRESET_COLORS.map((c) =>
      screen.getByRole("button", { name: `Select color ${c}` }),
    );
    expect(colorButtons).toHaveLength(7);
  });

  it("marks the first preset color as selected (aria-pressed=true) by default", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    expect(
      screen.getByRole("button", { name: `Select color ${PRESET_COLORS[0]}` }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("changes the selected color when a different preset is clicked", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    const secondColor = PRESET_COLORS[1];
    fireEvent.click(screen.getByRole("button", { name: `Select color ${secondColor}` }));

    expect(screen.getByRole("button", { name: `Select color ${secondColor}` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: `Select color ${PRESET_COLORS[0]}` }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  // -- Create label --

  it("calls createMutation.mutate with orgId, name, and selected color when Add is clicked", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Bug"), {
      target: { value: "Performance" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(createMutation.mutate).toHaveBeenCalledWith({
      orgId: ORG_ID,
      data: { name: "Performance", color: PRESET_COLORS[0] },
    });
  });

  it("calls createMutation.mutate when Enter is pressed in the name input", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    const nameInput = screen.getByPlaceholderText("e.g. Bug");
    fireEvent.change(nameInput, { target: { value: "Blocker" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });

    expect(createMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Blocker" }) as unknown }),
    );
  });

  it("clears the name input on mutation success", async () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Bug"), {
      target: { value: "Performance" },
    });

    act(() => {
      createMutation.simulateSuccess(makeLabel("new-id", "Performance"));
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. Bug")).toHaveValue("");
    });
  });

  it("invalidates labels.list on create success", () => {
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);

    createMutation.simulateSuccess(makeLabel("new-id", "Performance"));

    expect(mockInvalidateLabels).toHaveBeenCalledWith({ orgId: ORG_ID });
  });

  // -- Create error --

  it("shows the inline error alert when createMutation is in error state", () => {
    const errorText = "Label name already exists in this organization.";
    mockMutationError(api.labels.create, createMutation, errorText);
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  // -- Delete label flow --

  it("opens ConfirmDialog when a label's delete button is clicked", () => {
    setupLabelsQuery([LABEL_BUG]);
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[LABEL_BUG]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete label Bug" }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete label "Bug"/i)).toBeInTheDocument();
  });

  it("calls deleteMutation.mutate with orgId and labelId when confirmed", () => {
    setupLabelsQuery([LABEL_BUG]);
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[LABEL_BUG]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete label Bug" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({
      orgId: ORG_ID,
      labelId: LABEL_BUG.id,
    });
  });

  it("closes ConfirmDialog without calling mutate when Cancel is clicked", () => {
    setupLabelsQuery([LABEL_BUG]);
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[LABEL_BUG]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete label Bug" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    expect(deleteMutation.mutate).not.toHaveBeenCalled();
  });

  it("invalidates labels.list and closes dialog on delete success", async () => {
    setupLabelsQuery([LABEL_BUG]);
    renderUI(<LabelManager orgId={ORG_ID} initialLabels={[LABEL_BUG]} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete label Bug" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(mockInvalidateLabels).toHaveBeenCalledWith({ orgId: ORG_ID });

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });
});
