import { render, screen, waitFor } from "@testing-library/react";
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
import { makeMyInvitation, makeOrg } from "@/tests/support/factories";
import { mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

afterEach(() => {
  document.cookie = `${ACTIVE_ORG_COOKIE}=; path=/; max-age=0`;
  // Drain any nav-progress state left by a previous test - it's a module
  // singleton, not reset by restoreMocks.
  endNavProgress();
});

const orgA = makeOrg({ id: "org-a", name: "Org A", role: "OWNER" });
const orgB = makeOrg({ id: "org-b", name: "Org B", role: "MEMBER" });
const trigger = (): HTMLElement => screen.getByRole("button", { name: /switch organization/i });

describe("OrgSwitcher", () => {
  // -- Zero-org state --

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

  it("shows a pending-invitations row with a count badge when there are no orgs yet", async () => {
    mockUseQuery(api.orgs.list, []);
    mockUseQuery(api.invitations.listMine, [makeMyInvitation(), makeMyInvitation({ id: "inv-2" })]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);

    const invitationsRow = screen.getByRole("button", { name: /pending invitations/i });
    expect(invitationsRow).toHaveTextContent("2");

    await userEvent.setup().click(invitationsRow);
    expect(pushMock).toHaveBeenCalledWith("/invitations");
  });

  it("still shows a pending-invitations row (without a badge) when there are no orgs and no pending invitations", async () => {
    mockUseQuery(api.orgs.list, []);
    mockUseQuery(api.invitations.listMine, []);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);

    const invitationsRow = screen.getByRole("button", { name: /pending invitations/i });
    expect(invitationsRow).not.toHaveTextContent(/\d/);

    await userEvent.setup().click(invitationsRow);
    expect(pushMock).toHaveBeenCalledWith("/invitations");
  });

  // -- Trigger --

  it("shows the active org's name and role on the trigger", () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    expect(trigger()).toHaveTextContent("Org A");
    expect(trigger()).toHaveTextContent("OWNER");
  });

  it("opens the menu on trigger click, closes it on a second click", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the menu and focuses the first item on ArrowDown from the trigger", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    trigger().focus();
    await userEvent.setup().keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /org a/i })).toHaveFocus();
    });
  });

  it("also opens the menu on ArrowUp from the trigger", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    trigger().focus();
    await userEvent.setup().keyboard("{ArrowUp}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("ignores non-arrow keys on the trigger, leaving the menu closed", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    trigger().focus();
    await userEvent.setup().keyboard("a");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu on outside click", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(
      <div>
        <button>Outside</button>
        <OrgSwitcher />
      </div>,
    );
    const user = userEvent.setup();
    await user.click(trigger());
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  // -- Menu content --

  it("falls back to VIEWER for an org row with no memberships", async () => {
    mockUseQuery(api.orgs.list, [orgA, makeOrg({ id: "org-c", name: "Org C", memberships: [] })]);
    setupRouterMock();
    render(<OrgSwitcher />);
    await userEvent.setup().click(trigger());
    expect(screen.getByRole("menuitem", { name: /org c/i })).toHaveTextContent("VIEWER");
  });

  it("renders every org as a menuitem with its role badge", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    await userEvent.setup().click(trigger());
    const itemA = screen.getByRole("menuitem", { name: /org a/i });
    const itemB = screen.getByRole("menuitem", { name: /org b/i });
    expect(itemA).toHaveTextContent("OWNER");
    expect(itemB).toHaveTextContent("MEMBER");
  });

  it("marks the active org's menuitem with aria-current", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    await userEvent.setup().click(trigger());
    expect(screen.getByRole("menuitem", { name: /org a/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /org b/i })).not.toHaveAttribute("aria-current");
  });

  it("renders a pending-invitations row with a count badge when there are pending invitations", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, [makeMyInvitation(), makeMyInvitation({ id: "inv-2" })]);
    setupRouterMock();
    render(<OrgSwitcher />);
    await userEvent.setup().click(trigger());
    const invitationsItem = screen.getByRole("menuitem", { name: /pending invitations/i });
    expect(invitationsItem).toHaveTextContent("2");
  });

  it("renders the pending-invitations row without a badge when there are none", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, []);
    setupRouterMock();
    render(<OrgSwitcher />);
    await userEvent.setup().click(trigger());
    const invitationsItem = screen.getByRole("menuitem", { name: /pending invitations/i });
    expect(invitationsItem).not.toHaveTextContent(/\d/);
  });

  it("shows a count badge on the closed trigger itself when there are pending invitations", () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, [makeMyInvitation(), makeMyInvitation({ id: "inv-2" })]);
    setupRouterMock();
    render(<OrgSwitcher />);
    expect(trigger()).toHaveTextContent("2");
    expect(trigger()).toHaveAccessibleName(/2 pending invitations/i);
  });

  it("shows no badge on the closed trigger and no mention in its name when there are none", () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, []);
    setupRouterMock();
    render(<OrgSwitcher />);
    expect(trigger()).not.toHaveAccessibleName(/pending invitation/i);
  });

  it("navigates to /invitations and closes the menu when the invitations row is clicked", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /pending invitations/i }));
    expect(pushMock).toHaveBeenCalledWith("/invitations");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  // -- Keyboard navigation within the open menu --

  it("moves focus down and up between menuitems, wrapping at each end", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());

    const itemA = screen.getByRole("menuitem", { name: /org a/i });
    const itemB = screen.getByRole("menuitem", { name: /org b/i });
    const invitationsItem = screen.getByRole("menuitem", { name: /pending invitations/i });
    const createItem = screen.getByRole("menuitem", { name: /create organization/i });

    expect(itemA).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(itemB).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(invitationsItem).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(createItem).toHaveFocus();
    // Wraps back to the first item past the last one.
    await user.keyboard("{ArrowDown}");
    expect(itemA).toHaveFocus();
    // Wraps to the last item going up from the first one.
    await user.keyboard("{ArrowUp}");
    expect(createItem).toHaveFocus();
  });

  it("ignores keys it doesn't handle, leaving the menu open and focus untouched", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());

    const itemA = screen.getByRole("menuitem", { name: /org a/i });
    expect(itemA).toHaveFocus();
    await user.keyboard("a");
    expect(itemA).toHaveFocus();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("Home/End jump to the first/last menuitem", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());

    const itemA = screen.getByRole("menuitem", { name: /org a/i });
    const createItem = screen.getByRole("menuitem", { name: /create organization/i });

    await user.keyboard("{End}");
    expect(createItem).toHaveFocus();
    await user.keyboard("{Home}");
    expect(itemA).toHaveFocus();
  });

  it("Escape closes the menu and returns focus to the trigger", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("Tab closes the menu without blocking the browser's own focus movement", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  // -- Switching orgs --

  it("switches org and refreshes the router when there are no unsaved changes", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock, refreshMock } = setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /org b/i }));
    expect(pushMock).toHaveBeenCalledWith("/projects");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("clicking the already-active org just closes the menu without navigating", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /org a/i }));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog before switching when there are unsaved changes", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    const unregister = registerDirtyCheck(() => true);
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /org b/i }));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /discard and switch/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /discard and switch/i }));
    expect(pushMock).toHaveBeenCalledWith("/projects");
    unregister();
  });

  it("cancels the org switch via onClose", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    const unregister = registerDirtyCheck(() => true);
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /org b/i }));
    await user.click(screen.getByRole("button", { name: /cancel switch/i }));
    expect(pushMock).not.toHaveBeenCalled();
    unregister();
  });

  it("falls back to the first org when the active cookie references an org the user no longer belongs to", () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    document.cookie = `${ACTIVE_ORG_COOKIE}=ghost-org`;
    setupRouterMock();
    render(<OrgSwitcher />);
    expect(trigger()).toHaveTextContent("Org A");
  });

  // -- Create org --

  it("opens the create-org dialog from the menu's create row", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /create organization/i }));
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the create dialog and switches to the newly created org", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /create organization/i }));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(pushMock).toHaveBeenCalledWith("/projects");
  });

  // -- Nav progress --

  it("starts nav progress when switching org, and clears once the transition settles", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock, refreshMock } = setupRouterMock();
    render(<OrgSwitcher />);
    const user = userEvent.setup();
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /org b/i }));
    expect(pushMock).toHaveBeenCalledWith("/projects");
    expect(refreshMock).toHaveBeenCalled();
    // Always fires now, regardless of the current pathname: switching org
    // while already on /projects doesn't change the URL, but refresh()
    // still does the real work of re-fetching data for the new org, and
    // useAppRouter tracks that via a real transition instead of a pathname
    // comparison - see use-app-router.test.ts for the synchronous-start
    // assertion this component test doesn't need to duplicate.
    await waitFor(() => {
      expect(getNavProgress()).toBe(false);
    });
  });

  it("does nothing when onConfirm fires without a pendingOrgId set", () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher />);
    capturedConfirmProps.onConfirm?.();
    expect(pushMock).not.toHaveBeenCalled();
  });

  // -- Collapsed (icon-only) mode --

  it("renders only a compact invitations button when collapsed, with a count badge", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    mockUseQuery(api.invitations.listMine, [makeMyInvitation(), makeMyInvitation({ id: "inv-2" })]);
    const { pushMock } = setupRouterMock();
    render(<OrgSwitcher collapsed />);

    expect(screen.queryByRole("button", { name: /switch organization/i })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: /pending invitations/i });
    expect(button).toHaveTextContent("2");

    await userEvent.setup().click(button);
    expect(pushMock).toHaveBeenCalledWith("/invitations");
  });

  it("renders the compact invitations button without a badge when there are none", () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, []);
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    const button = screen.getByRole("button", { name: /pending invitations/i });
    expect(button).not.toHaveTextContent(/\d/);
    expect(button).not.toHaveAccessibleName(/,/);
  });

  it("shows the compact invitations button even while orgs are still loading", () => {
    mockUseQuery(api.orgs.list, undefined);
    mockUseQuery(api.invitations.listMine, [makeMyInvitation()]);
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    expect(screen.getByRole("button", { name: /pending invitations/i })).toHaveTextContent("1");
  });

  it("marks the compact invitations button as active (aria-current) when on /invitations", () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, []);
    vi.mocked(usePathname).mockReturnValue("/invitations");
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    expect(screen.getByRole("button", { name: /pending invitations/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark the compact invitations button as active on other routes", () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, []);
    vi.mocked(usePathname).mockReturnValue("/projects");
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    expect(screen.getByRole("button", { name: /pending invitations/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("also shows a compact create-organization button when collapsed with zero orgs", async () => {
    mockUseQuery(api.orgs.list, []);
    mockUseQuery(api.invitations.listMine, []);
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    const createButton = screen.getByRole("button", { name: /create organization/i });
    await userEvent.setup().click(createButton);
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("does not show the compact create-organization button when collapsed with existing orgs", () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(api.invitations.listMine, []);
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    expect(screen.queryByRole("button", { name: /create organization/i })).not.toBeInTheDocument();
  });

  it("does not show the compact create-organization button while orgs are still loading", () => {
    mockUseQuery(api.orgs.list, undefined);
    mockUseQuery(api.invitations.listMine, []);
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    expect(screen.queryByRole("button", { name: /create organization/i })).not.toBeInTheDocument();
  });

  it("resets menu state across a collapse/expand round trip (remounted via key at the call site, matching Sidebar)", async () => {
    mockUseQuery(api.orgs.list, [orgA, orgB]);
    setupRouterMock();
    const user = userEvent.setup();
    const { rerender } = render(<OrgSwitcher key="expanded" collapsed={false} />);

    await user.click(trigger());
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Sidebar re-keys OrgSwitcher on every collapse/expand toggle - simulate
    // that round trip here instead of just changing the `collapsed` prop in
    // place, which wouldn't remount and so wouldn't exercise the reset.
    rerender(<OrgSwitcher key="collapsed" collapsed />);
    rerender(<OrgSwitcher key="expanded" collapsed={false} />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("resets the create-org dialog across a collapse/expand round trip", async () => {
    mockUseQuery(api.orgs.list, [orgA]);
    setupRouterMock();
    const user = userEvent.setup();
    const { rerender } = render(<OrgSwitcher key="expanded" collapsed={false} />);

    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: /create organization/i }));
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();

    rerender(<OrgSwitcher key="collapsed" collapsed />);
    rerender(<OrgSwitcher key="expanded" collapsed={false} />);

    expect(screen.queryByRole("button", { name: /^create$/i })).not.toBeInTheDocument();
  });

  it("caps the compact invitations badge at '9+' for more than 9 invitations", () => {
    mockUseQuery(api.orgs.list, [orgA]);
    mockUseQuery(
      api.invitations.listMine,
      Array.from({ length: 10 }, (_, i) => makeMyInvitation({ id: `inv-${String(i)}` })),
    );
    setupRouterMock();
    render(<OrgSwitcher collapsed />);

    expect(screen.getByRole("button", { name: /pending invitations/i })).toHaveTextContent("9+");
  });
});
