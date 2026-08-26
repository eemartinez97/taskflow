import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-online-users", () => ({ useOnlineUsers: vi.fn(() => new Set<string>()) }));

let capturedConfirmProps: { onConfirm?: () => void; onClose?: () => void } = {};
vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: (props: { open: boolean; onConfirm: () => void; onClose: () => void }) => {
    capturedConfirmProps = props;
    return props.open ? (
      <>
        <button onClick={props.onConfirm}>Confirm Remove</button>
        <button onClick={props.onClose}>Cancel Remove</button>
      </>
    ) : null;
  },
}));

import { api } from "@/lib/trpc/client";
import { useOnlineUsers } from "@/lib/hooks/use-online-users";
import { MembersSection } from "@/app/(dashboard)/team/_components/members-section";
import { getLastMockUtils, mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { VALID_ORG_ID } from "@/tests/support/fixtures";

/** A second, inert row so a test's focal member doesn't accidentally trigger the "alone" empty state. */
const OTHER_TEAMMATE = {
  id: "m-other",
  userId: "other-teammate",
  role: "VIEWER" as const,
  user: { id: "other-teammate", name: "Other Teammate", email: "other@x.com" },
};

describe("MembersSection", () => {
  it("renders members, online status, and hides admin controls for members", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set(["online-user"]));
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "online-user",
        role: "MEMBER",
        user: { id: "online-user", name: "Alice", email: "a@x.com" },
      },
      {
        id: "m2",
        userId: "other-user",
        role: "MEMBER",
        user: { id: "other-user", name: "Bob", email: "b@x.com" },
      },
    ]);

    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="online-user"
        currentUserRole="MEMBER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Online")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /remove alice/i })).not.toBeInTheDocument();
  });

  it("shows online status for a teammate who is in the roster but isn't the current user", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set(["u-online"]));
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u-online",
        role: "MEMBER",
        user: { id: "u-online", name: "Carl", email: "c@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="someone-else"
        currentUserRole="MEMBER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    expect(screen.getAllByLabelText("Online")).toHaveLength(1);
  });

  it("changes role for owner", async () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u1",
        role: "ADMIN",
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    const { mutateMock } = setupMutationMock(api.orgs.updateMemberRole);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: /role for alice/i }), "MEMBER");
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      userId: "u1",
      data: { role: "MEMBER" },
    });
  });

  it("shows a role badge instead of the select when the viewer isn't an owner", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u1",
        role: "MEMBER",
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="MEMBER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
  });

  it("hides the remove button and shows a plain badge for an OWNER row", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u1",
        role: "OWNER",
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /remove alice/i })).not.toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
  });

  it("hides the remove button for the current user's own row", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "owner-id",
        role: "ADMIN",
        user: { id: "owner-id", name: "Me", email: "m@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /remove me/i })).not.toBeInTheDocument();
  });

  it("removes a member on confirm", async () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u1",
        role: "MEMBER",
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    const { mutateMock } = setupMutationMock(api.orgs.removeMember);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /remove alice/i }));
    await userEvent.setup().click(screen.getByRole("button", { name: /confirm remove/i }));
    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, userId: "u1" });
  });

  it("shows a success toast and invalidates members when the role mutation succeeds", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u1",
        role: "ADMIN",
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    const { triggerSuccess } = setupMutationMock(api.orgs.updateMemberRole);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    act(() => {
      triggerSuccess();
    });
    expect(getLastMockUtils().orgs.members.invalidate).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
    });
  });

  it("shows a success toast, invalidates, and clears the target when removeMutation succeeds", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u1",
        role: "MEMBER",
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    const { triggerSuccess } = setupMutationMock(api.orgs.removeMember);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    act(() => {
      triggerSuccess();
    });
    const utils = getLastMockUtils();
    expect(utils.orgs.members.invalidate).toHaveBeenCalledWith({ orgId: VALID_ORG_ID });
    expect(utils.orgs.assigneeLookup.invalidate).toHaveBeenCalledWith({ orgId: VALID_ORG_ID });
  });

  it("closes the remove-member confirmation without removing when cancelled", async () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "u1",
        role: "MEMBER",
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      OTHER_TEAMMATE,
    ]);
    const { mutateMock } = setupMutationMock(api.orgs.removeMember);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /remove alice/i }));
    await user.click(screen.getByRole("button", { name: /cancel remove/i }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("does nothing when onConfirm fires without a removeTarget", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, []);
    const { mutateMock } = setupMutationMock(api.orgs.removeMember);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    capturedConfirmProps.onConfirm?.();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  // -- Empty state (you're the only member) --

  it("shows the empty state with an Invite member CTA when you're alone and can admin", async () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "owner-id",
        role: "OWNER",
        user: { id: "owner-id", name: "Me", email: "m@x.com" },
      },
    ]);
    const onInviteClick = vi.fn();
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="owner-id"
        currentUserRole="OWNER"
        initialMembers={[]}
        onInviteClick={onInviteClick}
      />,
    );
    expect(screen.getByText(/you're the only one here/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /invite your first teammate/i }));
    expect(onInviteClick).toHaveBeenCalledOnce();
  });

  it("shows the empty state without a CTA when you're alone and can't admin", () => {
    vi.mocked(useOnlineUsers).mockReturnValue(new Set());
    mockUseQuery(api.orgs.members, [
      {
        id: "m1",
        userId: "member-id",
        role: "MEMBER",
        user: { id: "member-id", name: "Me", email: "m@x.com" },
      },
    ]);
    render(
      <MembersSection
        orgId={VALID_ORG_ID}
        currentUserId="member-id"
        currentUserRole="MEMBER"
        initialMembers={[]}
        onInviteClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/you're the only one here/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /invite your first teammate/i }),
    ).not.toBeInTheDocument();
  });
});
