import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { NotificationsPanel } from "@/components/layout/notifications-panel";
import { api } from "@/lib/trpc/client";
import { renderUI } from "../../helpers/render";
import { setupRouterMock } from "@/tests/support/render";

vi.mock("@/lib/hooks/use-notifications", () => ({
  useNotifications: vi.fn(() => ({ notifications: [], unreadCount: 0 })),
}));

import { useNotifications } from "@/lib/hooks/use-notifications";

// -- Fixtures --

interface MockNotification {
  id: string;
  message: string;
  read: boolean;
  createdAt: Date;
  entityType: string | null;
  entityId: string | null;
}

const UNREAD_TASK_NOTIF: MockNotification = {
  id: "notif-task-1",
  message: "Alice assigned you a task",
  read: false,
  createdAt: new Date("2024-03-01"),
  entityType: "task",
  entityId: "task-uuid-abc",
};

const READ_ORG_NOTIF: MockNotification = {
  id: "notif-org-1",
  message: "You were invited to Acme Corp",
  read: true,
  createdAt: new Date("2024-03-02"),
  entityType: "org",
  entityId: null,
};

const UNREAD_NO_ENTITY_NOTIF: MockNotification = {
  id: "notif-sys-1",
  message: "System maintenance scheduled",
  read: false,
  createdAt: new Date("2024-03-03"),
  entityType: null,
  entityId: null,
};

// -- Mock mutation setup helpers --

const mockOnClose = vi.fn();

let mockMarkReadMutate: ReturnType<typeof vi.fn>;
let mockMarkAllMutate: ReturnType<typeof vi.fn>;
let mockDeleteMutate: ReturnType<typeof vi.fn>;

function setupMutationMocks(): void {
  mockMarkReadMutate = vi.fn();
  mockMarkAllMutate = vi.fn();
  mockDeleteMutate = vi.fn();

  const makeReturn = (mutate: ReturnType<typeof vi.fn>) =>
    ({
      mutate,
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    }) as never;

  vi.mocked(api.notifications.markRead.useMutation).mockReturnValue(makeReturn(mockMarkReadMutate));
  vi.mocked(api.notifications.markAllRead.useMutation).mockReturnValue(
    makeReturn(mockMarkAllMutate),
  );
  vi.mocked(api.notifications.delete.useMutation).mockReturnValue(makeReturn(mockDeleteMutate));
}

// -- Tests --

describe("NotificationsPanel", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    setupMutationMocks();
  });

  // -- Rendering --

  it("renders the 'Notifications' heading", () => {
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders 'No notifications yet.' when the list is empty", () => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("renders the notification message when there is one notification", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getByText(UNREAD_TASK_NOTIF.message)).toBeInTheDocument();
  });

  it("renders the Close button", () => {
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getByRole("button", { name: /close notifications/i })).toBeInTheDocument();
  });

  it("has the region role with label 'Notifications'", () => {
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
  });

  // -- Close behavior --

  it("calls onClose when the Close (X) button is clicked", () => {
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close notifications/i }));

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking outside the panel", () => {
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.mouseDown(document.body);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("does NOT call onClose when clicking inside the panel", () => {
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.mouseDown(screen.getByRole("region", { name: "Notifications" }));

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // -- Mark all as read --

  it("does NOT render the 'Mark all as read' button when unreadCount is 0", () => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.queryByRole("button", { name: /mark all as read/i })).not.toBeInTheDocument();
  });

  it("renders the 'Mark all as read' button when unreadCount > 0", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument();
  });

  it("calls markAllRead mutation when 'Mark all as read' is clicked", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole("button", { name: /mark all as read/i }));

    expect(mockMarkAllMutate).toHaveBeenCalledOnce();
  });

  // -- Individual mark as read --

  it("renders the 'Mark as read' button for an unread notification", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getByRole("button", { name: "Mark as read" })).toBeInTheDocument();
  });

  it("does NOT render the 'Mark as read' button for an already-read notification", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [READ_ORG_NOTIF] as never,
      unreadCount: 0,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
  });

  it("calls markRead mutation with the notification id when 'Mark as read' is clicked", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));

    expect(mockMarkReadMutate).toHaveBeenCalledWith({ ids: [UNREAD_TASK_NOTIF.id] });
  });

  // -- Delete notification --

  it("renders a 'Delete notification' button for each notification", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF, READ_ORG_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);

    expect(screen.getAllByRole("button", { name: "Delete notification" })).toHaveLength(2);
  });

  it("calls delete mutation with the correct notificationId when delete is clicked", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete notification" }));

    expect(mockDeleteMutate).toHaveBeenCalledWith({ notificationId: UNREAD_TASK_NOTIF.id });
  });

  // -- Click to navigate --

  it("navigates to /tasks?task=<id> and closes panel when clicking a task notification", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(UNREAD_TASK_NOTIF.message));

    const expectedEntityId = UNREAD_TASK_NOTIF.entityId ?? "";
    expect(mockRouter.push).toHaveBeenCalledWith(`/tasks?task=${expectedEntityId}`);
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("marks the unread notification as read when it is clicked", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_TASK_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(UNREAD_TASK_NOTIF.message));

    expect(mockMarkReadMutate).toHaveBeenCalledWith({ ids: [UNREAD_TASK_NOTIF.id] });
  });

  it("does NOT call markRead when clicking an already-read notification", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [READ_ORG_NOTIF] as never,
      unreadCount: 0,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(READ_ORG_NOTIF.message));

    expect(mockMarkReadMutate).not.toHaveBeenCalled();
  });

  it("navigates to /team and closes panel when clicking an org notification", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [READ_ORG_NOTIF] as never,
      unreadCount: 0,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(READ_ORG_NOTIF.message));

    expect(mockRouter.push).toHaveBeenCalledWith("/team");
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("does NOT navigate or close the panel for a notification with no entity type", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [UNREAD_NO_ENTITY_NOTIF] as never,
      unreadCount: 1,
    });
    renderUI(<NotificationsPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(UNREAD_NO_ENTITY_NOTIF.message));

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
