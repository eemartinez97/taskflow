import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import type { MembershipWithUser } from "@taskflow/database";
import type { Role } from "@taskflow/shared";
import { TeamClient } from "@/app/(dashboard)/team/_components/team-client";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";

// -- Module mocks --

vi.mock("@/lib/hooks/use-online-users", () => ({
  useOnlineUsers: vi.fn(() => new Set<string>()),
}));
vi.mock("@/app/(dashboard)/team/_components/invite-dialog", () => ({
  InviteDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="invite-dialog">
        <button onClick={onClose}>Close invite</button>
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
        <button onClick={onConfirm}>Confirm remove</button>
        <button onClick={onClose}>Cancel remove</button>
      </div>
    ) : null,
}));

import { useOnlineUsers } from "@/lib/hooks/use-online-users";

// -- Fixtures --
function makeMember(userId: string, name: string, email: string, role: Role): MembershipWithUser {
  return {
    id: `membership-${userId}`,
    userId,
    orgId: "org-1",
    role,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    user: {
      id: userId,
      name,
      email,
      image: null,
    },
  } as MembershipWithUser;
}

const OWNER_MEMBER = makeMember("user-owner", "Alice", "alice@taskflow.dev", "OWNER");
const ADMIN_MEMBER = makeMember("user-admin", "Bob", "bob@taskflow.dev", "ADMIN");
const MEMBER_MEMBER = makeMember("user-member", "Carol", "carol@taskflow.dev", "MEMBER");
const VIEWER_MEMBER = makeMember("user-viewer", "Dave", "dave@taskflow.dev", "VIEWER");

const CURRENT_USER_ID = OWNER_MEMBER.userId;

// -- Helpers --
let mockInvalidateMembers: ReturnType<typeof vi.fn>;
let roleMutation: ReturnType<typeof wireCapturableMutation>;
let removeMutation: ReturnType<typeof wireCapturableMutation>;

function setupMembersQuery(members: MembershipWithUser[]): void {
  mockUseQuery(api.orgs.members, members);
}

function buildProps(
  overrides: Partial<Parameters<typeof TeamClient>[0]> = {},
): Parameters<typeof TeamClient>[0] {
  return {
    orgId: "org-1",
    currentUserId: CURRENT_USER_ID,
    currentUserRole: "OWNER",
    initialMembers: [OWNER_MEMBER, ADMIN_MEMBER, MEMBER_MEMBER],
    ...overrides,
  };
}

// -- Tests --
describe("TeamClient", () => {
  beforeEach(() => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set<string>());
    mockInvalidateMembers = vi.fn();
    mockApiUtils({ orgs: { members: { invalidate: mockInvalidateMembers } } });
    roleMutation = wireCapturableMutation(api.orgs.updateMemberRole);
    removeMutation = wireCapturableMutation(api.orgs.removeMember);
    setupMembersQuery([OWNER_MEMBER, ADMIN_MEMBER, MEMBER_MEMBER]);
  });

  // -- Rendering --

  it("renders the team member count in the heading", () => {
    renderUI(<TeamClient {...buildProps()} />);

    expect(screen.getByText("Team members (3)")).toBeInTheDocument();
  });

  it("renders each member's display name and email", () => {
    renderUI(<TeamClient {...buildProps()} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@taskflow.dev")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders the 'Invite member' button when the current user can admin", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "OWNER" })} />);

    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
  });

  it("does NOT render the 'Invite member' button for MEMBER role", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "MEMBER" })} />);

    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
  });

  it("does NOT show 'Invite member' or role controls for VIEWER role", () => {
    setupMembersQuery([OWNER_MEMBER, VIEWER_MEMBER]);
    renderUI(
      <TeamClient
        {...buildProps({
          currentUserId: VIEWER_MEMBER.userId,
          currentUserRole: "VIEWER",
          initialMembers: [OWNER_MEMBER, VIEWER_MEMBER],
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  // -- Online presence indicator --

  it("shows the online indicator for the current user (always online)", () => {
    renderUI(<TeamClient {...buildProps()} />);

    // The current user's row should have an "Online" aria-label indicator
    expect(screen.getByLabelText("Online")).toBeInTheDocument();
  });

  it("shows online indicator for members in the onlineUserIds set", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set([ADMIN_MEMBER.userId]));
    setupMembersQuery([OWNER_MEMBER, ADMIN_MEMBER]);
    renderUI(<TeamClient {...buildProps()} />);

    // Both current user and online member should have indicators
    expect(screen.getAllByLabelText("Online")).toHaveLength(2);
  });

  it("does NOT show online indicator for offline members", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set<string>());
    setupMembersQuery([OWNER_MEMBER, ADMIN_MEMBER]);
    renderUI(<TeamClient {...buildProps()} />);

    // Only the current user (OWNER) is always online
    expect(screen.getAllByLabelText("Online")).toHaveLength(1);
  });

  // -- Role display: Select vs Badge --

  it("renders a role Select for non-owner, non-self members when the current user is OWNER", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "OWNER" })} />);

    // ADMIN_MEMBER (non-owner, non-self) should have a role select
    expect(screen.getByRole("combobox", { name: `Role for Bob` })).toBeInTheDocument();
  });

  it("renders a Badge (not a Select) for the current user's own row", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "OWNER" })} />);

    // Alice is the current user - should show OWNER badge, not a select
    expect(screen.getByText("OWNER")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /role for alice/i })).not.toBeInTheDocument();
  });

  it("renders only Badges (no Selects) when the current user is not OWNER", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "ADMIN" })} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // All roles should appear as badge text
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
  });

  // -- Role mutation --

  it("calls updateMemberRole mutation when the role Select changes", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "OWNER" })} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Role for Bob" }), {
      target: { value: "MEMBER" },
    });

    expect(roleMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      userId: ADMIN_MEMBER.userId,
      data: { role: "MEMBER" },
    });
  });

  it("shows a 'Role updated' toast on mutation success", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "OWNER" })} />);

    roleMutation.simulateSuccess();

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Role updated");
    expect(mockInvalidateMembers).toHaveBeenCalledWith({ orgId: "org-1" });
  });

  // -- Remove member flow --

  it("shows a Remove button for non-owner, non-self members when the current user can admin", () => {
    renderUI(<TeamClient {...buildProps({ currentUserRole: "OWNER" })} />);

    expect(screen.getByRole("button", { name: /remove bob/i })).toBeInTheDocument();
  });

  it("does NOT show a Remove button for the OWNER member", () => {
    setupMembersQuery([OWNER_MEMBER, ADMIN_MEMBER]);
    renderUI(<TeamClient {...buildProps({ currentUserRole: "OWNER" })} />);

    // Alice (OWNER) should not have a remove button
    expect(screen.queryByRole("button", { name: /remove alice/i })).not.toBeInTheDocument();
  });

  it("does NOT show a Remove button for the current user themselves", () => {
    setupMembersQuery([OWNER_MEMBER, ADMIN_MEMBER]);
    renderUI(
      <TeamClient
        {...buildProps({
          currentUserId: OWNER_MEMBER.userId,
          currentUserRole: "OWNER",
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /remove alice/i })).not.toBeInTheDocument();
  });

  it("opens ConfirmDialog when the Remove button is clicked", () => {
    renderUI(<TeamClient {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /remove bob/i }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Remove member")).toBeInTheDocument();
  });

  it("calls removeMember mutation when ConfirmDialog is confirmed", () => {
    renderUI(<TeamClient {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /remove bob/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));

    expect(removeMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      userId: ADMIN_MEMBER.userId,
    });
  });

  it("closes ConfirmDialog and does NOT call mutate when Cancel is clicked", () => {
    renderUI(<TeamClient {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /remove bob/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel remove" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    expect(removeMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a 'Member removed.' toast after a successful removal", () => {
    renderUI(<TeamClient {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /remove bob/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));

    act(() => {
      removeMutation.simulateSuccess();
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Member removed.");
    expect(mockInvalidateMembers).toHaveBeenCalledWith({ orgId: "org-1" });
  });

  // -- Invite dialog --

  it("opens InviteDialog when 'Invite member' is clicked", () => {
    renderUI(<TeamClient {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));

    expect(screen.getByTestId("invite-dialog")).toBeInTheDocument();
  });

  it("closes InviteDialog when its close handler fires", () => {
    renderUI(<TeamClient {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close invite" }));

    expect(screen.queryByTestId("invite-dialog")).not.toBeInTheDocument();
  });
});
