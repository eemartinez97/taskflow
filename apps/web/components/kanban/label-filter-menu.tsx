"use client";

import { type JSX, useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";

import type { Label } from "@taskflow/database";
import { cn } from "@taskflow/ui";

import { useOutsideClick } from "@/lib/hooks/use-outside-click";

interface LabelFilterMenuProps {
  orgLabels: Label[];
  activeLabelIds: string[];
  onToggle: (labelId: string) => void;
  onClear: () => void;
}

/**
 * Popover version of the label filter - same OR-semantics toggle chips as
 * before, just behind a trigger instead of an always-visible row. Renders
 * nothing when the org has no labels at all, same as the row it replaces.
 */
export function LabelFilterMenu({
  orgLabels,
  activeLabelIds,
  onToggle,
  onClear,
}: LabelFilterMenuProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClick(containerRef, open, () => {
    setOpen(false);
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (orgLabels.length === 0) return null;

  const activeCount = activeLabelIds.length;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((p) => !p);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          activeCount > 0
            ? "border-brand-200 bg-brand-50 text-brand-700"
            : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        Filter
        {activeCount > 0 && (
          <span className="rounded-full bg-brand-100 px-1.5 py-px text-[11px] font-semibold text-brand-700">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[200px] rounded-lg border border-gray-200
                     bg-white p-2 shadow-lg"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {orgLabels.map((label) => {
              const active = activeLabelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onToggle(label.id);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity",
                    active ? "text-white" : "text-gray-600 opacity-60 hover:opacity-100",
                  )}
                  style={
                    active
                      ? { backgroundColor: label.color, borderColor: label.color }
                      : { borderColor: label.color }
                  }
                >
                  {label.name}
                </button>
              );
            })}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
