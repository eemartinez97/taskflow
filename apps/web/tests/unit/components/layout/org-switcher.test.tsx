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
import { api } from "@/lib/trpc/client";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { registerDirtyCheck } from "@/lib/utils/navigation-guard";
import { ACTIVE_ORG_COOKIE } from "@/lib/utils/active-org";
import { makeOrg } from "@/tests/support/factories";
import { mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

afterEach(() => {
  document.cookie = `${ACTIVE_ORG_COOKIE}=; path=/; max-age=0`;
});
const orgA = makeOrg({ id: "org-a", name: "Org A" });
const orgB = makeOrg({ id: "org-b", name: "Org B" });
describe("OrgSwitcher", () => {
  it("renders nothing when there are no orgs", () => {
    mockUseQuery(api.orgs.list, []);
    const { container } = render(<OrgSwitcher />);
    expect(container).toBeEmptyDOMElement();
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
  it("does nothing when onConfirm fires without a pendingOrgId set", () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);
    capturedConfirmProps.onConfirm?.();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
