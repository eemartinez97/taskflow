import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { api } from "@/lib/trpc/client";
import { NAV_ITEMS } from "@/lib/constants/navigation";
import { mockSession } from "@/tests/mocks/next-auth";
import { renderUI } from "../../helpers/render";

vi.mock("@/lib/hooks/use-global-realtime", () => ({ useGlobalRealtime: vi.fn() }));
vi.mock("@/lib/hooks/use-notifications", () => ({
  useNotifications: vi.fn(() => ({ notifications: [], unreadCount: 0 })),
}));
vi.mock("@/components/layout/notifications-panel", () => ({
  NotificationsPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="notifications-panel">
      <button onClick={onClose}>Close panel</button>
    </div>
  ),
}));

import { useNotifications } from "@/lib/hooks/use-notifications";

// Helpers

/** Returns a mutation mock that immediately invokes onSettled when mutate is called. */
function makeSignOutMutation() {
  const mutate = vi.fn((_data: undefined, opts?: { onSettled?: () => void }) =>
    opts?.onSettled?.(),
  );
  return {
    mutate,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
  } as const;
}

// Tests

describe("Header", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: vi.fn().mockResolvedValue(mockSession),
    });
  });

  // -- Page title --

  it.each(NAV_ITEMS)(
    "renders '$label' as the page title when pathname is '$href'",
    ({ label, href }) => {
      vi.mocked(usePathname).mockReturnValue(href);
      renderUI(<Header />);

      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    },
  );

  it("renders 'Dashboard' when the pathname does not match any nav item", () => {
    vi.mocked(usePathname).mockReturnValue("/unknown");
    renderUI(<Header />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  // -- Notification bell --

  it("renders the notification bell button", () => {
    renderUI(<Header />);

    expect(screen.getByRole("button", { name: /^notifications/i })).toBeInTheDocument();
  });

  it("does NOT render a badge when unreadCount is 0", () => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    renderUI(<Header />);

    // The badge text would be "0" - it must not appear
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders the unread count in a badge when unreadCount is greater than 0", () => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 5 });
    renderUI(<Header />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders '9+' in the badge when unreadCount exceeds 9", () => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 15 });
    renderUI(<Header />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("includes the unread count in the bell button aria-label", () => {
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 3 });
    renderUI(<Header />);

    expect(screen.getByRole("button", { name: "Notifications (3 unread)" })).toBeInTheDocument();
  });

  // -- Notifications panel toggle --

  it("does NOT render the notifications panel on initial render", () => {
    renderUI(<Header />);

    expect(screen.queryByTestId("notifications-panel")).not.toBeInTheDocument();
  });

  it("shows the notifications panel when the bell button is clicked", () => {
    renderUI(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /^notifications/i }));

    expect(screen.getByTestId("notifications-panel")).toBeInTheDocument();
  });

  it("hides the notifications panel when the bell is clicked a second time", () => {
    renderUI(<Header />);
    const bell = screen.getByRole("button", { name: /^notifications/i });

    fireEvent.click(bell);
    fireEvent.click(bell);

    expect(screen.queryByTestId("notifications-panel")).not.toBeInTheDocument();
  });

  it("closes the notifications panel when the panel calls its onClose prop", () => {
    renderUI(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /^notifications/i }));

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));

    expect(screen.queryByTestId("notifications-panel")).not.toBeInTheDocument();
  });

  // -- User avatar --

  it("renders the user's initials derived from the session name", () => {
    // mockSession.user.name = "Alice" -> initials = "A"
    renderUI(<Header />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders '??' in the avatar when the session has no user", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });
    renderUI(<Header />);

    expect(screen.getByText("??")).toBeInTheDocument();
  });

  // -- Sign out --

  it("calls signOutMutation.mutate when the sign-out button is clicked", () => {
    const mockMutate = vi.fn();
    vi.mocked(api.auth.signOut.useMutation).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as never);

    renderUI(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it("calls next-auth signOut with /login callbackUrl once the mutation settles", () => {
    vi.mocked(api.auth.signOut.useMutation).mockReturnValue(makeSignOutMutation() as never);

    renderUI(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(vi.mocked(signOut)).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("calls next-auth signOut even when the mutation fails (onSettled guarantee)", () => {
    const mutation = makeSignOutMutation();
    // Simulate a failed mutation - onSettled must still fire
    vi.mocked(api.auth.signOut.useMutation).mockReturnValue({
      ...mutation,
      isError: true,
    } as never);

    renderUI(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(vi.mocked(signOut)).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
