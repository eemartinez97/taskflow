"use client";

import { useEffect, useSyncExternalStore, type JSX } from "react";
import { usePathname } from "next/navigation";

import { useGlobalLoading } from "@/lib/hooks/use-global-loading";
import {
  endNavProgress,
  getNavProgress,
  getServerNavProgress,
  startNavProgress,
  subscribeNavProgress,
} from "@/lib/utils/nav-progress";

/** Safety net - if a navigation never resolves to a pathname change (e.g. it
 * fails, or only search params changed), don't leave the bar stuck forever. */
const FALLBACK_CLEAR_MS = 8000;

/**
 * Thin top-of-page progress bar + "wait" cursor for route transitions.
 *
 * On a slow deployment, clicking a link can take a moment to navigate with
 * nothing on screen telling the user their click registered. This listens
 * for clicks on internal links (any <a> rendered by next/link) to start the
 * bar immediately, and clears it once the pathname actually changes.
 * Programmatic navigations (router.push after a mutation, org switch, etc.)
 * call startNavProgress() directly at the call site.
 */
export function NavProgressBar(): JSX.Element | null {
  // navActive (this store only) arms the fallback timer and the pathname
  // clear - both exist to un-stick a navigation specifically, and would be
  // wrong to key off a mutation/query that's legitimately still running.
  // active (nav OR query/mutation) is what's actually rendered.
  const navActive = useSyncExternalStore(
    subscribeNavProgress,
    getNavProgress,
    getServerNavProgress,
  );
  const active = useGlobalLoading();
  const pathname = usePathname();

  useEffect(() => {
    endNavProgress();
  }, [pathname]);

  useEffect(() => {
    if (!navActive) return;
    const timer = setTimeout(endNavProgress, FALLBACK_CLEAR_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [navActive]);

  useEffect(() => {
    // Capture phase: must run BEFORE next/link's own click handler, which
    // calls preventDefault() to hijack the navigation for client-side
    // routing. A bubble-phase listener on document fires after that (React
    // delegates onClick at the root container, which is lower in the DOM
    // than document), so e.defaultPrevented would already be true and every
    // real Link click would be silently skipped.
    function handleClick(e: MouseEvent): void {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      // A nested control (e.g. a card's 3-dot menu button) inside the <a>
      // handles and stops its own click - the anchor never actually
      // navigates. Without this check, that stopPropagation() happens too
      // late (it runs at bubble phase, after this capture-phase listener),
      // so the bar would start and never clear until the 8s fallback.
      const nestedControl = target.closest("button, [role='button'], input, select, textarea");
      if (nestedControl && anchor.contains(nestedControl)) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      startNavProgress();
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("tf-nav-loading", active);
  }, [active]);

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-brand-100"
    >
      <div className="tf-nav-progress-bar h-full w-1/3 bg-brand-600" />
    </div>
  );
}
