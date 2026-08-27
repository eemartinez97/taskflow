"use client";

import { type JSX, useEffect, useCallback, useRef } from "react";
import { Check, CheckCheck, Trash2, X } from "lucide-react";

import { Button } from "@taskflow/ui";

import { api } from "@/lib/trpc/client";
import { setActiveOrgId } from "@/lib/utils/active-org";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useInvitationActions } from "@/components/invitations/use-invitation-actions";
import { formatDate } from "@/lib/utils/date";
import type { MyInvitation } from "@taskflow/shared";

interface NotificationsPanelProps {
  onClose: () => void;
  /**
   * Navigates and closes the panel. Deliberately NOT this component's own
   * useAppRouter() call: onClose() below unmounts NotificationsPanel (its
   * parent renders it as `{isOpen && <NotificationsPanel .../>}`), which
   * would tear down a locally-owned push()'s useTransition before its
   * pending -> settled effect ever fires - orphaning the endNavProgress()
   * call and leaving the top progress bar/content dim stuck until the 8s
   * fallback timer. Header owns this instead, since it never unmounts
   * across a dashboard navigation (it's rendered once in the (dashboard)
   * layout), so its transition reliably clears when the destination
   * actually finishes loading.
   */
  onNavigate: (href: string) => void;
}

export function NotificationsPanel({ onClose, onNavigate }: NotificationsPanelProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();

  const data = useNotifications();
  const { data: myInvitations } = api.invitations.listMine.useQuery();
  const { accept, decline, isAccepting, isDeclining } = useInvitationActions();

  /** MEMBER_INVITED notifications carry the org id as entityId - same value listMine's orgId field. */
  function findInvitation(orgId: string | null): MyInvitation | undefined {
    return myInvitations?.find((inv) => inv.orgId === orgId);
  }

  const invalidateList = useCallback(() => {
    void utils.notifications.list.invalidate();
  }, [utils]);

  const markReadMutation = api.notifications.markRead.useMutation({
    onSuccess: invalidateList,
  });

  const markAllMutation = api.notifications.markAllRead.useMutation({
    onSuccess: invalidateList,
  });

  const deleteMutation = api.notifications.delete.useMutation({
    onSuccess: invalidateList,
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  function notificationHref(n: {
    type: string;
    entityType: string | null;
    entityId: string | null;
  }): string | null {
    if (n.entityType === "task" && n.entityId) return `/tasks?task=${n.entityId}`;
    // MEMBER_INVITED fires before the recipient accepts, so they aren't an
    // org member yet - /organizations/<id> would bounce them to /team with a
    // misleading "no longer part of" toast. Send them to the pending-
    // invitations list instead, where the same Accept/Decline lives.
    if (n.entityType === "org" && n.entityId) {
      return n.type === "MEMBER_INVITED" ? "/invitations" : `/team?from=${n.entityId}`;
    }
    return null;
  }

  function handleOpen(n: {
    id: string;
    read: boolean;
    type: string;
    entityType: string | null;
    entityId: string | null;
  }): void {
    if (!n.read) markReadMutation.mutate({ ids: [n.id] });

    const href = notificationHref(n);
    if (!href) return;

    // INVITATION_ACCEPTED/DECLINED point at the org that fired them, which
    // may not be the sidebar's currently active org - set the cookie
    // client-side first (same mechanism org-switcher.tsx uses) so /team
    // renders that org directly, instead of routing through proxy.ts's
    // /organizations/<id> deep-link redirect (a full extra network
    // round trip, un-prefetchable from an imperative push) just to get the
    // same cookie write and land on the same /team?from=<id> URL.
    if (n.entityType === "org" && n.entityId && n.type !== "MEMBER_INVITED") {
      setActiveOrgId(n.entityId);
    }

    onClose();
    onNavigate(href);
  }

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200
                 bg-white shadow-lg overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">Notifications</span>
        <div className="flex items-center gap-1">
          {data.unreadCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mark all as read"
              title="Mark all read"
              onClick={() => {
                markAllMutation.mutate();
              }}
              className="h-7 w-7 text-gray-400 hover:text-brand-600"
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close notifications"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
        {data.notifications.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-gray-400">No notifications yet.</li>
        )}

        {data.notifications.map((n) => {
          const invitation = n.type === "MEMBER_INVITED" ? findInvitation(n.entityId) : undefined;

          return (
            <li
              key={n.id}
              onClick={() => {
                handleOpen(n);
              }}
              className={`flex items-start gap-3 px-4 py-3 text-sm transition-colors ${
                notificationHref(n) ? "cursor-pointer hover:bg-gray-50" : ""
              } ${n.read ? "text-gray-500" : "bg-brand-50/30 text-gray-800"}`}
            >
              <div className="flex-1 min-w-0">
                <p className="leading-snug">{n.message}</p>
                <p className="mt-0.5 text-xs text-gray-400">{formatDate(n.createdAt)}</p>

                {invitation && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isDeclining}
                      onClick={(e) => {
                        e.stopPropagation();
                        decline({ invitationId: invitation.id });
                      }}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      disabled={isAccepting}
                      onClick={(e) => {
                        e.stopPropagation();
                        accept({ invitationId: invitation.id });
                      }}
                    >
                      Accept
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-1">
                {!n.read && (
                  <button
                    type="button"
                    aria-label="Mark as read"
                    onClick={(e) => {
                      e.stopPropagation();
                      markReadMutation.mutate({ ids: [n.id] });
                    }}
                    className="rounded p-1 text-gray-300 hover:text-brand-600"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate({ notificationId: n.id });
                  }}
                  className="h-7 w-7 text-gray-300 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
