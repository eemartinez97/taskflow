"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@taskflow/ui";

import { NotificationsPanel } from "./notifications-panel";
import { NAV_ITEMS, SECONDARY_ROUTE_TITLES } from "@/lib/constants/navigation";
import { useAppRouter } from "@/lib/hooks/use-app-router";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { userInitials } from "@/lib/utils/user";
import { api } from "@/lib/trpc/client";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useGlobalRealtime } from "@/lib/hooks/use-global-realtime";

export function Header(): JSX.Element {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useAppRouter();
  const notifPanel = useDisclosure();
  const signOutMutation = api.auth.signOut.useMutation();
  useGlobalRealtime();

  function handleSignOut(): void {
    // Invalidate server-side sessions first, then clear the NextAuth JWT.
    // onSettled guarantees the client logout runs even if the API call fails.
    signOutMutation.mutate(undefined, { onSettled: () => void signOut({ callbackUrl: "/login" }) });
  }

  const title =
    [...NAV_ITEMS, ...SECONDARY_ROUTE_TITLES].find((item) => pathname.startsWith(item.href))
      ?.label ?? "Dashboard";

  const data = useNotifications();

  const initials = session?.user ? userInitials(session.user) : "??";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-2 relative">
        {/* Notification bell */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${data.unreadCount > 0 ? ` (${String(data.unreadCount)} unread)` : ""}`}
            onClick={notifPanel.toggle}
          >
            <Bell className="h-4 w-4" />
            {data.unreadCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center
                               rounded-full bg-red-500 text-[10px] font-medium text-white"
              >
                {data.unreadCount > 9 ? "9+" : data.unreadCount}
              </span>
            )}
          </Button>

          {notifPanel.isOpen && (
            <NotificationsPanel
              onClose={notifPanel.close}
              onNavigate={(href) => {
                router.push(href);
              }}
            />
          )}
        </div>

        {/* User avatar */}
        <div
          suppressHydrationWarning
          aria-label={`User: ${session?.user.name ?? "Unknown"}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
        >
          <span suppressHydrationWarning>{initials}</span>
        </div>

        {/* Sign out */}
        <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
