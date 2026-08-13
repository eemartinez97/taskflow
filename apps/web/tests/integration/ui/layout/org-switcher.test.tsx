import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { api } from "@/lib/trpc/client";
import {
  getServerActiveOrgId,
  readActiveOrgId,
  setActiveOrgId,
  subscribeActiveOrg,
} from "@/lib/utils/active-org";
import { hasUnsavedChanges } from "@/lib/utils/navigation-guard";
import { renderUI } from "../../helpers/render";
import { mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

// -- Module mocks --

vi.mock("@/lib/utils/active-org", () => ({
  readActiveOrgId: vi.fn<() => string | null>(() => null),
  setActiveOrgId: vi.fn<(id: string) => void>(),
  clearActiveOrgId: vi.fn<() => void>(),
  subscribeActiveOrg: vi.fn<(listener: () => void) => () => void>(() => () => undefined),
  getServerActiveOrgId: vi.fn<() => string | null>(() => null),
  ACTIVE_ORG_COOKIE: "taskflow.activeOrgId",
}));

vi.mock("@/lib/utils/navigation-guard", () => ({
  hasUnsavedChanges: vi.fn<() => boolean>(() => false),
  registerDirtyCheck: vi.fn(() => () => undefined),
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
            onCreated("new-org-id");
          }}
        >
          Confirm create
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
        <button onClick={onConfirm}>Confirm switch</button>
        <button onClick={onClose}>Cancel switch</button>
      </div>
    ) : null,
}));

// -- Helpers & fixtures --

const mockReadActiveOrgId = vi.mocked(readActiveOrgId);
const mockSetActiveOrgId = vi.mocked(setActiveOrgId);
const mockHasUnsavedChanges = vi.mocked(hasUnsavedChanges);

const MOCK_ORGS = [
  { id: "org-1", name: "Acme Corp", slug: "acme-corp", memberships: [{ role: "OWNER" as const }] },
  { id: "org-2", name: "Globex", slug: "globex", memberships: [{ role: "MEMBER" as const }] },
];

function mockOrgsList(orgs: typeof MOCK_ORGS): void {
  mockUseQuery(api.orgs.list, orgs);
}

function trigger(): HTMLElement {
  return screen.getByRole("button", { name: /switch organization/i });
}

// -- Tests --

describe("OrgSwitcher", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    mockReadActiveOrgId.mockReturnValue(null);
    vi.mocked(getServerActiveOrgId).mockReturnValue(null);
    vi.mocked(subscribeActiveOrg).mockReturnValue(() => undefined);
    mockHasUnsavedChanges.mockReturnValue(false);
    mockOrgsList(MOCK_ORGS);
    mockUseQuery(api.invitations.listMine, []);
  });

  // -- Null / empty states --

  it("renders nothing when orgs data is undefined (loading state)", () => {
    mockUseQuery(api.orgs.list, undefined, {
      isLoading: true,
      isPending: true,
      isFetching: true,
      isSuccess: false,
    });

    const { container } = renderUI(<OrgSwitcher />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a create-organization button when the orgs list is empty", () => {
    mockOrgsList([]);

    renderUI(<OrgSwitcher />);

    expect(screen.getByRole("button", { name: /create organization/i })).toBeInTheDocument();
  });

  it("opens CreateOrgDialog and switches to the new org when the orgs list is empty", () => {
    mockOrgsList([]);

    renderUI(<OrgSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));

    expect(screen.getByTestId("create-org-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm create" }));

    expect(mockSetActiveOrgId).toHaveBeenCalledWith("new-org-id");
    expect(mockRouter.push).toHaveBeenCalledWith("/projects");
  });

  // -- Rendering --

  it("shows the active org's name and role on the trigger", () => {
    renderUI(<OrgSwitcher />);

    expect(trigger()).toHaveTextContent("Acme Corp");
    expect(trigger()).toHaveTextContent("OWNER");
  });

  it("renders a menuitem for each org once opened", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());

    expect(screen.getByRole("menuitem", { name: /acme corp/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /globex/i })).toBeInTheDocument();
  });

  it("renders the Create organization menuitem", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());

    expect(screen.getByRole("menuitem", { name: /create organization/i })).toBeInTheDocument();
  });

  // -- Active org selection --

  it("selects the first org when the active-org cookie is not set", () => {
    mockReadActiveOrgId.mockReturnValue(null);
    renderUI(<OrgSwitcher />);

    expect(trigger()).toHaveTextContent("Acme Corp");
  });

  it("selects the matched org when the cookie value corresponds to an existing org", () => {
    mockReadActiveOrgId.mockReturnValue("org-2");
    renderUI(<OrgSwitcher />);

    expect(trigger()).toHaveTextContent("Globex");
  });

  it("falls back to the first org when the cookie value is stale (org no longer exists)", () => {
    mockReadActiveOrgId.mockReturnValue("deleted-org-id");
    renderUI(<OrgSwitcher />);

    expect(trigger()).toHaveTextContent("Acme Corp");
  });

  // -- Switching orgs --

  it("calls setActiveOrgId and router.push('/projects') when a different org is selected", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /globex/i }));

    expect(mockSetActiveOrgId).toHaveBeenCalledWith("org-2");
    expect(mockRouter.push).toHaveBeenCalledWith("/projects");
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  // -- Create org --

  it("opens CreateOrgDialog from the menu", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /create organization/i }));

    expect(screen.getByTestId("create-org-dialog")).toBeInTheDocument();
  });

  it("does NOT switch org or navigate when the create-org menuitem is clicked", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /create organization/i }));

    expect(mockSetActiveOrgId).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("switches to the new org and navigates when CreateOrgDialog calls onCreated", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /create organization/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm create" }));

    expect(mockSetActiveOrgId).toHaveBeenCalledWith("new-org-id");
    expect(mockRouter.push).toHaveBeenCalledWith("/projects");
  });

  it("closes CreateOrgDialog when its Cancel button is clicked", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /create organization/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel create" }));

    expect(screen.queryByTestId("create-org-dialog")).not.toBeInTheDocument();
  });

  // -- Unsaved changes guard --

  it("shows ConfirmDialog and does NOT switch immediately when there are unsaved changes", () => {
    mockHasUnsavedChanges.mockReturnValue(true);
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /globex/i }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(mockSetActiveOrgId).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("switches to the pending org when the ConfirmDialog is confirmed", () => {
    mockHasUnsavedChanges.mockReturnValue(true);
    renderUI(<OrgSwitcher />);

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /globex/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm switch" }));

    expect(mockSetActiveOrgId).toHaveBeenCalledWith("org-2");
    expect(mockRouter.push).toHaveBeenCalledWith("/projects");
  });

  it("does NOT switch and closes ConfirmDialog when Cancel is clicked", () => {
    mockHasUnsavedChanges.mockReturnValue(true);
    renderUI(<OrgSwitcher />);

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /globex/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel switch" }));

    expect(mockSetActiveOrgId).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });

  // -- Pending invitations --

  it("shows a count badge on the invitations row when there are pending invitations", () => {
    mockUseQuery(api.invitations.listMine, [{ id: "inv-1" }, { id: "inv-2" }]);
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());

    expect(screen.getByRole("menuitem", { name: /pending invitations/i })).toHaveTextContent("2");
  });

  it("navigates to /invitations when the invitations row is clicked", () => {
    renderUI(<OrgSwitcher />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /pending invitations/i }));

    expect(mockRouter.push).toHaveBeenCalledWith("/invitations");
  });
});
