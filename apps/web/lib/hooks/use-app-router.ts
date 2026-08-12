"use client";

import { useRouter as useNextRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useTransition } from "react";

import { endNavProgress, startNavProgress } from "@/lib/utils/nav-progress";

type NextRouter = ReturnType<typeof useNextRouter>;
type NavigateOptions = Parameters<NextRouter["push"]>[1];

/**
 * Drop-in replacement for next/navigation's useRouter() that drives the
 * global nav-progress bar/cursor/content-dim (see lib/utils/nav-progress.ts)
 * off React's own transition-pending state, the same mechanism next/link's
 * useLinkStatus() is built on - App Router navigation is itself built on
 * React transitions, so wrapping push/refresh in this hook's own
 * useTransition correctly reports pending for the FULL navigation
 * (including the destination route's server data fetch), not just the
 * synchronous call to push()/refresh() returning.
 *
 * This matters for two cases a "did the pathname change yet" guess can't
 * cover: a same-URL push + explicit refresh() (e.g. switching org while
 * already on /projects - see org-switcher.tsx, where the URL never
 * changes and only the refresh actually re-fetches data), and slow
 * real-network navigations where local testing's near-instant round trip
 * hides how little feedback there actually is in production.
 *
 * startNavProgress() itself is still called synchronously the moment
 * push/refresh is invoked (immediate feedback, no dependence on transition
 * timing), while endNavProgress() is driven by isPending settling back to
 * false - a real completion signal instead of a pathname comparison, so it
 * can't clear early or stay stuck regardless of what actually changed.
 *
 * Link clicks are already covered globally by NavProgressBar's own
 * document-level click listener - this closes the other half (a redirect
 * after a mutation, an org/board switch, etc.), so any future programmatic
 * navigation gets the indicator automatically just by using this hook
 * instead of the raw one, with nothing to remember at the call site.
 *
 * push only forwards `options` when the caller actually passed one, to keep
 * the exact same call shape a direct useRouter() caller would produce (some
 * tests assert on the mocked router's call args).
 */
export function useAppRouter(): NextRouter {
  const router = useNextRouter();
  const [isPending, startAppTransition] = useTransition();

  // Only clear on the falling edge (this instance's OWN transition just
  // settled), never merely because isPending happens to read false - it
  // starts false on every mount, including a component mounting mid-flight
  // during a DIFFERENT navigation it never started, which must not clear
  // the shared global indicator out from under that other navigation.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending) endNavProgress();
    wasPending.current = isPending;
  }, [isPending]);

  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: NavigateOptions) => {
        startNavProgress();
        startAppTransition(() => {
          if (options === undefined) router.push(href);
          else router.push(href, options);
        });
      },
      refresh: () => {
        startNavProgress();
        startAppTransition(() => {
          router.refresh();
        });
      },
    }),
    [router, startAppTransition],
  );
}
