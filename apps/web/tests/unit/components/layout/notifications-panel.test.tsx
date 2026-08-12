import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-notifications", () => ({ useNotifications: vi.fn() }));
vi.mock("@/components/invitations/use-invitation-actions", () => ({
  useInvitationActions: vi.fn(() => ({
    accept: vi.fn(),
    decline: vi.fn(),
    isAccepting: false,
    isDeclining: false,
  })),
}));

import { api } from "@/lib/trpc/client";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useInvitationActions } from "@/components/invitations/use-invitation-actions";
import { NotificationsPanel } from "@/components/layout/notifications-panel";
import { mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import type { AppRouter } from "@taskflow/api/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { VALID_ORG_ID, VALID_USER_ID } from "@/tests/support/fixtures";
import { makeMyInvitation } from "@/tests/support/factories";

type NotificationsData = inferRouterOutputs<AppRouter>["notifications"]["list"];
type NotificationItem = NotificationsData["notifications"][number];

export function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n-default",
    userId: VALID_USER_ID,
    actorId: null,
    type: "TASK_ASSIGNED",
    message: "Default notification message",
    read: false,
    entityId: null,
    entityType: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    actor: null,
    ...overrides,
  };
}

const taskNotification = makeNotification({
  id: "n1",
  message: "New task assigned",
  type: "TASK_ASSIGNED",
  entityType: "task",
  entityId: "task-1",
});

const orgNotification = makeNotification({
  id: "n2",
  message: "You joined an org",
  read: true,
  type: "MEMBER_INVITED",
  entityType: "org",
  entityId: VALID_ORG_ID,
});

const genericNotification = makeNotification({
  id: "n3",
  message: "Generic",
  type: "COMMENT_CREATED",
});

describe("NotificationsPanel", () => {
  it("shows an empty state with no notifications", () => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    render(<NotificationsPanel onClose={vi.fn()} />);
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("shows the 'mark all read' button only when there are unread notifications", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [taskNotification],
      unreadCount: 1,
    });
    render(<NotificationsPanel onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument();
  });

  it("marks all as read on click", async () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [taskNotification],
      unreadCount: 1,
    });
    const { mutateMock } = setupMutationMock(vi.mocked(api.notifications.markAllRead));
    render(<NotificationsPanel onClose={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /mark all as read/i }));
    expect(mutateMock).toHaveBeenCalled();
  });

  it("closes on the X button", async () => {
    const onClose = vi.fn();
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    render(<NotificationsPanel onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /close notifications/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on an outside click", async () => {
    const onClose = vi.fn();
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    render(
      <div>
        <button>outside</button>
        <NotificationsPanel onClose={onClose} />
      </div>,
    );
    await userEvent.setup().click(screen.getByText("outside"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("marks a task notification as read and navigates to /tasks?task=<id> on click", async () => {
    const onClose = vi.fn();
    setupRouterMock();
    const { pushMock } = setupRouterMock();
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [taskNotification],
      unreadCount: 1,
    });
    const { mutateMock } = setupMutationMock(vi.mocked(api.notifications.markRead));
    render(<NotificationsPanel onClose={onClose} />);
    await userEvent.setup().click(screen.getByText("New task assigned"));
    expect(mutateMock).toHaveBeenCalledWith({ ids: ["n1"] });
    expect(pushMock).toHaveBeenCalledWith("/tasks?task=task-1");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("navigates to /organizations/<entityId> for an org notification without marking read (already read)", async () => {
    const { pushMock } = setupRouterMock();
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [orgNotification],
      unreadCount: 0,
    });
    const { mutateMock } = setupMutationMock(vi.mocked(api.notifications.markRead));
    render(<NotificationsPanel onClose={vi.fn()} />);
    await userEvent.setup().click(screen.getByText("You joined an org"));
    expect(mutateMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith(`/organizations/${VALID_ORG_ID}`);
  });

  it("does not navigate for an org notification with no entityId", async () => {
    const { pushMock } = setupRouterMock();
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [makeNotification({ id: "n4", type: "MEMBER_INVITED", entityType: "org" })],
      unreadCount: 0,
    });
    render(<NotificationsPanel onClose={vi.fn()} />);
    await userEvent.setup().click(screen.getByText("Default notification message"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not navigate for a notification with no resolvable href", async () => {
    const { pushMock } = setupRouterMock();
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [genericNotification],
      unreadCount: 1,
    });
    const { mutateMock } = setupMutationMock(vi.mocked(api.notifications.markRead));
    render(<NotificationsPanel onClose={vi.fn()} />);
    await userEvent.setup().click(screen.getByText("Generic"));
    expect(mutateMock).toHaveBeenCalledWith({ ids: ["n3"] });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("marks a single notification as read via its own button, stopping propagation", async () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [taskNotification],
      unreadCount: 1,
    });
    setupRouterMock();
    const { mutateMock } = setupMutationMock(vi.mocked(api.notifications.markRead));
    render(<NotificationsPanel onClose={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /mark as read/i }));
    expect(mutateMock).toHaveBeenCalledWith({ ids: ["n1"] });
  });

  it("deletes a notification via its delete button, stopping propagation", async () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [taskNotification],
      unreadCount: 1,
    });
    setupRouterMock();
    const { mutateMock } = setupMutationMock(vi.mocked(api.notifications.delete));
    render(<NotificationsPanel onClose={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /delete notification/i }));
    expect(mutateMock).toHaveBeenCalledWith({ notificationId: "n1" });
  });

  it("invalidates the notifications list when markRead succeeds", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [taskNotification],
      unreadCount: 1,
    });
    const { triggerSuccess } = setupMutationMock(vi.mocked(api.notifications.markRead));
    render(<NotificationsPanel onClose={vi.fn()} />);
    triggerSuccess();
  });

  describe("inline invitation actions", () => {
    it("shows Accept/Decline on a MEMBER_INVITED row with a matching pending invitation", () => {
      vi.mocked(useNotifications).mockReturnValue({
        notifications: [orgNotification],
        unreadCount: 0,
      });
      mockUseQuery(api.invitations.listMine, [
        makeMyInvitation({ id: "inv-1", orgId: VALID_ORG_ID }),
      ]);
      render(<NotificationsPanel onClose={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    });

    it("hides Accept/Decline when no listMine row matches the notification's org", () => {
      vi.mocked(useNotifications).mockReturnValue({
        notifications: [orgNotification],
        unreadCount: 0,
      });
      mockUseQuery(api.invitations.listMine, [
        makeMyInvitation({ id: "inv-1", orgId: "some-other-org" }),
      ]);
      render(<NotificationsPanel onClose={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    });

    it("hides Accept/Decline for a non-MEMBER_INVITED org notification even with a matching row", () => {
      vi.mocked(useNotifications).mockReturnValue({
        notifications: [
          makeNotification({ type: "TASK_UPDATED", entityType: "org", entityId: VALID_ORG_ID }),
        ],
        unreadCount: 0,
      });
      mockUseQuery(api.invitations.listMine, [
        makeMyInvitation({ id: "inv-1", orgId: VALID_ORG_ID }),
      ]);
      render(<NotificationsPanel onClose={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    });

    it("accepts without marking read or navigating (stopPropagation)", async () => {
      const { pushMock } = setupRouterMock();
      const accept = vi.fn();
      vi.mocked(useInvitationActions).mockReturnValue({
        accept,
        decline: vi.fn(),
        isAccepting: false,
        isDeclining: false,
      });
      vi.mocked(useNotifications).mockReturnValue({
        notifications: [orgNotification],
        unreadCount: 0,
      });
      mockUseQuery(api.invitations.listMine, [
        makeMyInvitation({ id: "inv-1", orgId: VALID_ORG_ID }),
      ]);
      const { mutateMock } = setupMutationMock(vi.mocked(api.notifications.markRead));
      render(<NotificationsPanel onClose={vi.fn()} />);

      await userEvent.setup().click(screen.getByRole("button", { name: "Accept" }));

      expect(accept).toHaveBeenCalledWith({ invitationId: "inv-1" });
      expect(mutateMock).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("declines without marking read or navigating (stopPropagation)", async () => {
      setupRouterMock();
      const decline = vi.fn();
      vi.mocked(useInvitationActions).mockReturnValue({
        accept: vi.fn(),
        decline,
        isAccepting: false,
        isDeclining: false,
      });
      vi.mocked(useNotifications).mockReturnValue({
        notifications: [orgNotification],
        unreadCount: 0,
      });
      mockUseQuery(api.invitations.listMine, [
        makeMyInvitation({ id: "inv-1", orgId: VALID_ORG_ID }),
      ]);
      render(<NotificationsPanel onClose={vi.fn()} />);

      await userEvent.setup().click(screen.getByRole("button", { name: "Decline" }));

      expect(decline).toHaveBeenCalledWith({ invitationId: "inv-1" });
    });
  });
});
