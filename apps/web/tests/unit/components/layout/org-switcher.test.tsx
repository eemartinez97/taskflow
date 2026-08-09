import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/organizations/create-org-dialog", () => ({
  CreateOrgDialog: ({ open, onCreated }: { open: boolean; onCreated: (id: string) => void }) =>
    open ? (
      <button
        onClick={() => {
          onCreated("brand-new-org");
        }}
      >
        Create
      </button>
    ) : null,
}));
let capturedConfirmProps: { onConfirm?: () => void; onClose?: () => void } = {};
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: { open: boolean; onConfirm: () => void; onClose: () => void }) => {
    capturedConfirmProps = props;
    return props.open ? (
      <>
        <button onClick={props.onConfirm}>Discard and switch</button>
        <button onClick={props.onClose}>Cancel Switch</button>
      </>
    ) : null;
  },
}));
import { usePathname } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { registerDirtyCheck } from "@/lib/utils/navigation-guard";
import { ACTIVE_ORG_COOKIE } from "@/lib/utils/active-org";
import { endNavProgress, getNavProgress } from "@/lib/utils/nav-progress";
import { makeOrg } from "@/tests/support/factories";
import { mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

afterEach(() => {
  document.cookie = `${ACTIVE_ORG_COOKIE}=; path=/; max-age=0`;
  // Drain any nav-progress state left by a previous test - it's a module
  // singleton, not reset by restoreMocks.
  endNavProgress();
});
const orgA = makeOrg({ id: "org-a", name: "Org A" });
const orgB = makeOrg({ id: "org-b", name: "Org B" });
describe("OrgSwitcher", () => {
  it("renders a create-organization button when there are no orgs", () => {
    mockUseQuery(api.orgs.list, []);
    setupRouterMock();
    render(<OrgSwitcher />);
    expect(screen.getByRole("button", { name: /create organization/i })).toBeInTheDocument();
  });
  it("opens the create-org dialog and switches to the new org when there are no orgs", async () => {
    mockUseQuery(api.orgs.list, []);
    const { pushMock, refreshMock } = setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create organization/i }));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(pushMock).toHaveBeenCalledWith("/projects");
    expect(refreshMock).toHaveBeenCalled();
  });
  it("renders nothing while the query is still loading (data undefined)", () => {
    mockUseQuery(api.orgs.list, undefined);
    const { container } = render(<OrgSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
  it("switches org and refreshes the router when there are no unsaved changes", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock, refreshMock } = setupRouterMock();
    render(<OrgSwitcher />);
    await userEvent.setup().selectOptions(screen.getByLabelText(/select organization/i), orgB.id);
    expect(pushMock).toHaveBeenCalledWith("/projects");
    expect(refreshMock).toHaveBeenCalled();
  });
  it("opens a confirmation dialog before switching when there are unsaved changes", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    const unregister = registerDirtyCheck(() => true);
    render(<OrgSwitcher />);
    await userEvent.setup().selectOptions(screen.getByLabelText(/select organization/i), orgB.id);
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /discard and switch/i })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /discard and switch/i }));
    expect(pushMock).toHaveBeenCalledWith("/projects");
    unregister();
  });
  it("opens the create-org dialog when the sentinel option is selected", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    setupRouterMock();
    render(<OrgSwitcher />);
    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText(/select organization/i), "__create_org__");
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
  });
  it("falls back to the first org when the active cookie references an org the user no longer belongs to", () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    document.cookie = `${ACTIVE_ORG_COOKIE}=ghost-org`;
    setupRouterMock();
    render(<OrgSwitcher />);
    expect(screen.getByLabelText(/select organization/i)).toHaveValue(orgA.id);
  });
  it("cancels the org switch via onClose", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    const unregister = registerDirtyCheck(() => true);
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/select organization/i), orgB.id);
    await user.click(screen.getByRole("button", { name: /cancel switch/i }));
    expect(pushMock).not.toHaveBeenCalled();
    unregister();
  });
  it("closes the create dialog and switches to the newly created org", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/select organization/i), "__create_org__");
    await user.click(screen.getByRole("button", { name: /create/i }));
    expect(pushMock).toHaveBeenCalledWith("/projects");
  });
  it("starts nav progress when switching org from a page other than /projects", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    vi.mocked(usePathname).mockReturnValue("/tasks");
    render(<OrgSwitcher />);
    await userEvent.setup().selectOptions(screen.getByLabelText(/select organization/i), orgB.id);
    expect(getNavProgress()).toBe(true);
  });
  it("does not start nav progress when already on /projects (pathname won't change)", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    vi.mocked(usePathname).mockReturnValue("/projects");
    render(<OrgSwitcher />);
    await userEvent.setup().selectOptions(screen.getByLabelText(/select organization/i), orgB.id);
    expect(getNavProgress()).toBe(false);
  });
  it("does nothing when onConfirm fires without a pendingOrgId set", () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);
    capturedConfirmProps.onConfirm?.();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
