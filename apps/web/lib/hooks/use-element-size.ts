"use client";

import { useEffect, useState, type RefObject } from "react";

/** Live width/height of a DOM element via ResizeObserver. Starts at 0,0. */
export function useElementSize(ref: RefObject<HTMLElement | null>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;

      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    });

    observer.observe(el);

    const width = el.clientWidth;
    const height = el.clientHeight;

    setSize((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
