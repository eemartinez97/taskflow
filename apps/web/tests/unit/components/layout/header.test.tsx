import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/use-notifications", () => ({ useNotifications: vi.fn() }));
vi.mock("@/lib/hooks/use-global-realtime", () => ({ useGlobalRealtime: vi.fn() }));
vi.mock("@/components/layout/notifications-panel", () => ({
  NotificationsPanel: ({ onClose }: { onClose: () => void }) => (
    <div>
      Panel
      <button onClick={onClose}>close-panel</button>
    </div>
  ),
}));

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { Header } from "@/components/layout/header";
import { mockSession } from "@/tests/support/fixtures";
import { setupMutationMockWithMutateCallbacks } from "@/tests/support/trpc";

describe("Header", () => {
  it("shows 'Dashboard' as a fallback title when the pathname matches no NAV_ITEM", () => {
    vi.mocked(usePathname).mockReturnValue("/unknown-route");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    render(<Header />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("derives the title from NAV_ITEMS for a known route", () => {
    vi.mocked(usePathname).mockReturnValue("/projects/123");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    render(<Header />);
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
  });

  it("shows the unread count badge when there are unread notifications", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 3 });
    render(<Header />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the unread count display at '9+'", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 15 });
    render(<Header />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("toggles the notifications panel on bell click", async () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    render(<Header />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("Panel")).toBeInTheDocument();
    await user.click(screen.getByText("close-panel"));
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
  });

  it("shows user initials from the session", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    render(<Header />);
    expect(
      screen.getByLabelText(`User: ${mockSession.user.name ?? "unknown"}`),
    ).toBeInTheDocument();
  });

  it("shows '??' initials when there is no session user", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });
    render(<Header />);
    expect(screen.getByLabelText("User: Unknown")).toBeInTheDocument();
  });

  it("invalidates sessions server-side then signs out client-side on Sign out click", async () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    vi.mocked(useNotifications).mockReturnValue({ notifications: [], unreadCount: 0 });
    const { mutateMock } = setupMutationMockWithMutateCallbacks(api.auth.signOut);
    render(<Header />);
    await userEvent.setup().click(screen.getByRole("button", { name: /sign out/i }));
    expect(mutateMock).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
