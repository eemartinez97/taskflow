import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { LeaveOrgSection } from "@/app/(dashboard)/settings/_components/leave-org-section";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

// @taskflow/ui, @/lib/trpc/client and @/lib/toast/store are mocked globally
// in tests/setup/integration.ui.ts.

vi.mock("@/lib/utils/active-org", () => ({ clearActiveOrgId: vi.fn() }));

// Stub ConfirmDialog - same convention as organization-section's own test.
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
        <button onClick={onConfirm}>Confirm leave</button>
        <button onClick={onClose}>Cancel leave</button>
      </div>
    ) : null,
}));

const ORG_ID = "org-uuid-1";
const ORG_NAME = "Acme Corp";

let mockInvalidateOrgsList: ReturnType<typeof vi.fn>;
let leaveMutation: ReturnType<typeof wireCapturableMutation>;

describe("LeaveOrgSection", () => {
  const { router } = setupRouterMock();

  beforeEach(() => {
    mockInvalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: mockInvalidateOrgsList } } });
    leaveMutation = wireCapturableMutation(api.orgs.leave);
  });

  // -- Rendering --

  it("renders the Leave organization heading", () => {
    renderUI(<LeaveOrgSection orgId={ORG_ID} orgName={ORG_NAME} role="MEMBER" />);
    expect(screen.getByText("Leave organization")).toBeInTheDocument();
  });

  it("shows the leave button for a non-owner", () => {
    renderUI(<LeaveOrgSection orgId={ORG_ID} orgName={ORG_NAME} role="ADMIN" />);
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
  });

  it("shows an explanatory message instead of a button for the OWNER", () => {
    renderUI(<LeaveOrgSection orgId={ORG_ID} orgName={ORG_NAME} role="OWNER" />);
    expect(screen.getByText(/as the owner, you can't leave/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave" })).not.toBeInTheDocument();
  });

  // -- Confirm flow --

  it("opens ConfirmDialog when Leave organization is clicked", () => {
    renderUI(<LeaveOrgSection orgId={ORG_ID} orgName={ORG_NAME} role="MEMBER" />);
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
  });

  it("calls the leave mutation with the orgId when confirmed", () => {
    renderUI(<LeaveOrgSection orgId={ORG_ID} orgName={ORG_NAME} role="MEMBER" />);
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm leave" }));

    expect(leaveMutation.mutate).toHaveBeenCalledWith({ orgId: ORG_ID });
  });

  it("closes ConfirmDialog without leaving when cancelled", () => {
    renderUI(<LeaveOrgSection orgId={ORG_ID} orgName={ORG_NAME} role="MEMBER" />);
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel leave" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    expect(leaveMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Success handling --

  it("clears the active org, invalidates orgs.list, navigates to /projects and toasts on success", () => {
    renderUI(<LeaveOrgSection orgId={ORG_ID} orgName={ORG_NAME} role="MEMBER" />);

    leaveMutation.simulateSuccess();

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(`You left ${ORG_NAME}.`);
    expect(mockInvalidateOrgsList).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/projects");
  });
});
