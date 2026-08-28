"use client";

import { useEffect, useRef } from "react";

/**
 * Closes an open menu/popover on Escape while `active` is true. No-ops
 * while `active` is false, so the listener isn't attached at all for a
 * closed menu. Shared by DropdownMenu, BoardSwitcher and LabelFilterMenu,
 * which previously each inlined an identical effect.
 *
 * `onEscape` is read through a ref (updated every render, not an effect
 * dep) rather than closed over directly, matching useOutsideClick's
 * rationale - keeps the listener from re-attaching every render and rules
 * out a stale closure for a future caller whose callback closes over
 * changing props/state.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onEscapeRef.current();
    }
    if (active) document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [active]);
}
