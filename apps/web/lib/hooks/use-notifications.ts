"use client";

import { api } from "@/lib/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@taskflow/api/trpc";

type NotificationsData = inferRouterOutputs<AppRouter>["notifications"]["list"];

/** Stable empty default - single source of truth for the notifications shape. */
const EMPTY: NotificationsData = { notifications: [], unreadCount: 0 };

/**
 * Single access point for the notifications list query.
 * This query OWNS the notifications cache: it performs the initial fetch and
 * the 30s `refetchInterval` acts as a fallback re-sync.
 *
 * Real-time delivery is a separate push path (use-notifications-realtime.ts)
 * that writes into THIS same cache via `setData` on NOTIFICATION_CREATED.
 * Socket = fast path; query + polling = owner + safety net. One source of truth.
 */
export function useNotifications(): NotificationsData {
  const { data = EMPTY } = api.notifications.list.useQuery(undefined, { refetchInterval: 30_000 });
  return data;
}
