"use client";

import { useIsFetching, useIsMutating, type FetchStatus } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import {
  getNavProgress,
  getServerNavProgress,
  subscribeNavProgress,
} from "@/lib/utils/nav-progress";

interface FreshLoadingQueryCandidate {
  state: { fetchStatus: FetchStatus; data: unknown };
}

/**
 * Exported for direct unit testing - useIsFetching's own filtering logic
 * isn't re-tested here, just that this predicate correctly identifies a
 * query the user has nothing cached for yet.
 */
export function isFreshLoadingQuery(query: FreshLoadingQueryCandidate): boolean {
  return query.state.fetchStatus === "fetching" && query.state.data === undefined;
}

function noop(): void {
  // no-op unsubscribe: this snapshot never changes after mount
}
const noopSubscribe = (): (() => void) => noop;
const getHydratedSnapshot = (): boolean => true;

/**
 * Exported for direct unit testing, same reason as nav-progress.ts's
 * getServerNavProgress - React only ever calls this via a real SSR/hydrate
 * pass (never a plain client-only render()), so a component-level test
 * can't reach it to cover the branch.
 */
export function getServerHydratedSnapshot(): boolean {
  return false;
}

/**
 * True only after the client has hydrated. React's documented idiom for
 * this: useSyncExternalStore renders with getServerSnapshot during SSR and
 * during the hydration pass (matching the server HTML), then switches to
 * getSnapshot for every render after - no effect/setState needed, so no
 * extra cascading render and no `react-hooks/set-state-in-effect` lint
 * violation.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, getHydratedSnapshot, getServerHydratedSnapshot);
}

/**
 * True while a navigation is in flight (see nav-progress.ts) OR any tRPC
 * mutation is pending OR any query with no cached data yet is loading for
 * the first time - i.e. whenever the user triggered something (a click, a
 * navigation, a CRUD action) and has nothing to show for it yet.
 *
 * Deliberately excludes background revalidation of already-visible data
 * (React Query's stale-while-revalidate refetches, polling, window-focus
 * refetches) via the `data === undefined` check - those are silent by
 * design, not something the user is waiting on, and surfacing them here
 * would make the indicator flicker constantly instead of meaning anything.
 *
 * Single source of truth for NavProgressBar and DashboardContent so both
 * stay in sync with the same definition of "loading" without duplicating
 * the query-client wiring in each.
 *
 * The mutation/query signals below have no SSR-stable snapshot the way
 * nav-progress does (getServerNavProgress) - React Query's client is fresh
 * on the server render and can already have a query in flight by the time
 * the client hydrates, so reading them on the very first client render can
 * disagree with the server-rendered HTML and trip a hydration mismatch.
 * `useHydrated()` pins that first render to the same "not loading" value
 * the server used; the real value takes over on the render right after
 * hydration.
 */
export function useGlobalLoading(): boolean {
  const navActive = useSyncExternalStore(
    subscribeNavProgress,
    getNavProgress,
    getServerNavProgress,
  );
  const isMutating = useIsMutating();
  const isLoadingFresh = useIsFetching({ predicate: isFreshLoadingQuery });
  const hydrated = useHydrated();

  return navActive || (hydrated && (isMutating > 0 || isLoadingFresh > 0));
}
