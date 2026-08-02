"use client";

import { type JSX, useEffect, useCallback, useRef } from "react";
import { Check, CheckCheck, Trash2, X } from "lucide-react";

import { Button } from "@taskflow/ui";

import { api } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/hooks/use-notifications";

interface NotificationsPanelProps {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();
  const router = useRouter();

  const data = useNotifications();

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
    entityType: string | null;
    entityId: string | null;
  }): string | null {
    if (n.entityType === "task" && n.entityId) return `/tasks?task=${n.entityId}`;
    if (n.entityType === "org") return "/team";
    return null;
  }

  function handleOpen(n: {
    id: string;
    read: boolean;
    entityType: string | null;
    entityId: string | null;
  }): void {
    if (!n.read) markReadMutation.mutate({ ids: [n.id] });

    const href = notificationHref(n);
    if (!href) return;

    onClose();
    router.push(href);
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

        {data.notifications.map((n) => (
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
              <p className="mt-0.5 text-xs text-gray-400">
                {new Date(n.createdAt).toLocaleDateString()}
              </p>
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
        ))}
      </ul>
    </div>
  );
}
