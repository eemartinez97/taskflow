import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import type { OrgWithMembership } from "@taskflow/database";
import { OrganizationsClient } from "@/app/(dashboard)/organizations/_components/organizations-client";
import { api } from "@/lib/trpc/client";
import { clearActiveOrgId, setActiveOrgId } from "@/lib/utils/active-org";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { makeOrg } from "@/tests/support/factories";

// -- Module mocks --
// @taskflow/ui, @/lib/trpc/client and @/lib/toast/store are mocked globally
// in tests/setup/integration.ui.ts.

vi.mock("@/lib/utils/active-org", () => ({
  clearActiveOrgId: vi.fn(),
  setActiveOrgId: vi.fn(),
  readActiveOrgId: vi.fn(() => null),
  subscribeActiveOrg: vi.fn(() => () => undefined),
  getServerActiveOrgId: vi.fn(() => null),
  ACTIVE_ORG_COOKIE: "taskflow.activeOrgId",
}));

// Stub child dialogs - each has its own dedicated test file
vi.mock("@/app/(dashboard)/organizations/_components/edit-org-dialog", () => ({
  EditOrgDialog: ({
    org,
    open,
    onClose,
  }: {
    org: { name: string };
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="edit-org-dialog">
        <span>{org.name}</span>
        <button onClick={onClose}>Close edit</button>
      </div>
    ) : null,
}));

vi.mock("@/components/organizations/create-org-dialog", () => ({
  CreateOrgDialog: ({
    open,
    onClose,
    onCreated,
  }: {
    open: boolean;
    onClose: () => void;
    onCreated: (id: string) => void;
  }) =>
    open ? (
      <div data-testid="create-org-dialog">
        <button
          onClick={() => {
            onCreated("brand-new-org-id");
          }}
        >
          Create org
        </button>
        <button onClick={onClose}>Cancel create</button>
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
const OWNER_ORG = makeOrg({ id: "org-owner", name: "Acme Corp", role: "OWNER" });
const ADMIN_ORG = makeOrg({ id: "org-admin", name: "Globex", role: "ADMIN" });
const MEMBER_ORG = makeOrg({ id: "org-member", name: "Initech", role: "MEMBER" });
const VIEWER_ORG = makeOrg({ id: "org-viewer", name: "Umbrella", role: "VIEWER" });

// -- Helpers --

let mockInvalidateOrgsList: ReturnType<typeof vi.fn>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;

function setupQueryMock(orgs: OrgWithMembership[]): void {
  mockUseQuery(api.orgs.list, orgs);
}

// -- Tests --
describe("OrganizationsClient", () => {
  const { router } = setupRouterMock();

  beforeEach(() => {
    mockInvalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: mockInvalidateOrgsList } } });
    deleteMutation = wireCapturableMutation(api.orgs.delete);
    setupQueryMock([OWNER_ORG]);
  });

  // -- Rendering --

  it("renders the org count in the heading", () => {
    setupQueryMock([OWNER_ORG, ADMIN_ORG]);
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG, ADMIN_ORG]} />);

    expect(screen.getByText("Your organizations (2)")).toBeInTheDocument();
  });

  it("renders the org name for each org", () => {
    setupQueryMock([OWNER_ORG, ADMIN_ORG]);
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG, ADMIN_ORG]} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("renders the org slug prefixed with '/' for each org", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);

    expect(screen.getByText("/acme-corp")).toBeInTheDocument();
  });

  it("renders the 'New organization' button", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);

    expect(screen.getByRole("button", { name: /new organization/i })).toBeInTheDocument();
  });

  // -- Role-based button visibility --

  it("shows Edit button for OWNER role", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);

    expect(screen.getByRole("button", { name: /edit acme corp/i })).toBeInTheDocument();
  });

  it("shows Edit button for ADMIN role", () => {
    setupQueryMock([ADMIN_ORG]);
    renderUI(<OrganizationsClient initialOrgs={[ADMIN_ORG]} />);

    expect(screen.getByRole("button", { name: /edit globex/i })).toBeInTheDocument();
  });

  it("shows Delete button only for OWNER role", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);

    expect(screen.getByRole("button", { name: /delete acme corp/i })).toBeInTheDocument();
  });

  it("does NOT show Delete button for ADMIN role", () => {
    setupQueryMock([ADMIN_ORG]);
    renderUI(<OrganizationsClient initialOrgs={[ADMIN_ORG]} />);

    expect(screen.queryByRole("button", { name: /delete globex/i })).not.toBeInTheDocument();
  });

  it("does NOT show Edit or Delete buttons for MEMBER role", () => {
    setupQueryMock([MEMBER_ORG]);
    renderUI(<OrganizationsClient initialOrgs={[MEMBER_ORG]} />);

    expect(screen.queryByRole("button", { name: /edit initech/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete initech/i })).not.toBeInTheDocument();
  });

  it("does NOT show Edit or Delete buttons for VIEWER role", () => {
    setupQueryMock([VIEWER_ORG]);
    renderUI(<OrganizationsClient initialOrgs={[VIEWER_ORG]} />);

    expect(screen.queryByRole("button", { name: /edit umbrella/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete umbrella/i })).not.toBeInTheDocument();
  });

  // -- Edit dialog --

  it("opens EditOrgDialog when the Edit button is clicked", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /edit acme corp/i }));

    expect(screen.getByTestId("edit-org-dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Acme Corp", { selector: "[data-testid='edit-org-dialog'] span" }),
    ).toBeInTheDocument();
  });

  it("closes EditOrgDialog when its Close handler is invoked", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /edit acme corp/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close edit" }));

    expect(screen.queryByTestId("edit-org-dialog")).not.toBeInTheDocument();
  });

  // -- Delete flow --

  it("opens ConfirmDialog when the Delete button is clicked", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /delete acme corp/i }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete organization")).toBeInTheDocument();
  });

  it("calls deleteMutation.mutate with the correct orgId when confirmed", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /delete acme corp/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({ orgId: OWNER_ORG.id });
  });

  it("closes ConfirmDialog when Cancel is clicked without calling mutate", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /delete acme corp/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    expect(deleteMutation.mutate).not.toHaveBeenCalled();
  });

  it("calls clearActiveOrgId after a successful delete", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /delete acme corp/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess(undefined, { orgId: OWNER_ORG.id });
    });

    expect(vi.mocked(clearActiveOrgId)).toHaveBeenCalledOnce();
  });

  it("invalidates orgs.list and calls router.refresh after a successful delete", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /delete acme corp/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess(undefined, { orgId: OWNER_ORG.id });
    });

    expect(mockInvalidateOrgsList).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows a success toast after a successful delete", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /delete acme corp/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess(undefined, { orgId: OWNER_ORG.id });
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Organization deleted.");
  });

  // -- Create org dialog --

  it("opens CreateOrgDialog when 'New organization' is clicked", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /new organization/i }));

    expect(screen.getByTestId("create-org-dialog")).toBeInTheDocument();
  });

  it("calls setActiveOrgId and router.refresh when CreateOrgDialog calls onCreated", () => {
    renderUI(<OrganizationsClient initialOrgs={[OWNER_ORG]} />);
    fireEvent.click(screen.getByRole("button", { name: /new organization/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create org" }));

    expect(vi.mocked(setActiveOrgId)).toHaveBeenCalledWith("brand-new-org-id");
    expect(router.refresh).toHaveBeenCalled();
  });
});
