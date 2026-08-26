"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Closes an open menu/popover on a mousedown outside `ref`'s subtree.
 * No-ops while `active` is false, so the listener isn't attached at all for
 * a closed menu. Shared by DropdownMenu and OrgSwitcher, which previously
 * each inlined an identical effect.
 *
 * `onOutsideClick` is read through a ref (updated every render, not an
 * effect dep) rather than closed over directly - both current callers only
 * ever pass a stable setState callback, but this keeps the listener from
 * re-attaching on every render and rules out a stale closure for any future
 * caller whose callback closes over changing props/state.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutsideClick: () => void,
): void {
  const onOutsideClickRef = useRef(onOutsideClick);
  useEffect(() => {
    onOutsideClickRef.current = onOutsideClick;
  });

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutsideClickRef.current();
      }
    }
    if (active) document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [active, ref]);
}
