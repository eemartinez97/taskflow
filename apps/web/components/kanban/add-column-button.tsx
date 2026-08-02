"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@taskflow/ui";

interface AddColumnButtonProps {
  onAdd: (name: string) => void;
  loading?: boolean;
  /**
   * Total columns on the board. When it grows while the input is open, the
   * control scrolls itself back into view (batch entry follow-along).
   */
  columnCount: number;
}

/**
 * Inline "add column" control.
 *
 * Collapsed: a slim full-height rail (w-10, no explicit height so it inherits
 * the board row's `align-items: stretch`, same as every column) with just a
 * "+" icon - deliberately narrower than a real column so it never reads as
 * one while idle.
 *
 * Expanded: renders a "ghost column" that reuses KanbanColumn's EXACT header
 * markup/classes (`flex items-center justify-between rounded-md bg-gray-50
 * px-3 py-2`), with the input replacing the title. This guarantees the input
 * sits at the same vertical position as every other column's title BY
 * CONSTRUCTION - not by approximating a spacer height, which drifted.
 */
export function AddColumnButton({
  onAdd,
  loading = false,
  columnCount,
}: AddColumnButtonProps): JSX.Element {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the control visible: when it opens, and every time a new column
  // renders and pushes it further right.
  useEffect(() => {
    if (!adding) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [adding, columnCount]);

  function submit(): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
  }

  function cancel(): void {
    setAdding(false);
    setName("");
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => {
          setAdding(true);
        }}
        aria-label="Add column"
        title="Add column"
        className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 self-stretch
                   rounded-md border border-dashed border-gray-200 text-gray-300
                   transition-colors hover:border-brand-300 hover:bg-brand-50/40
                   hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-brand-500"
      >
        <Plus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="flex w-64 shrink-0 flex-col gap-2 self-start">
      {/*
        Same row as KanbanColumn's header (shrink-0, rounded-md bg-gray-50
        px-3 py-2, items-center): the input occupies exactly the title's slot,
        so its vertical center matches every other column's name - by reusing
        the identical container, not by estimating its height separately.
      */}
      <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-gray-50 mt-2 px-3 py-2">
        <input
          ref={inputRef}
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={() => {
            if (!name.trim()) cancel();
          }}
          placeholder="Column name"
          maxLength={100}
          aria-label="New column name"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold uppercase tracking-wide
                     text-gray-700 placeholder:text-gray-400 placeholder:normal-case
                     focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || loading}
          aria-label="Confirm new column"
          className="shrink-0 rounded p-0.5 text-brand-600 hover:bg-brand-100
                     disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel new column"
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Secondary confirm action for mouse users who prefer a labeled
          button over the icon-only header controls above. */}
      {loading && (
        <Button size="sm" loading disabled className="self-start">
          Adding…
        </Button>
      )}
    </div>
  );
}
