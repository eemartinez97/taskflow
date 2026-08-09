"use client";

import { useRef, useState, type JSX } from "react";

import { cn } from "./utils";

export interface InlineEditTextProps {
  value: string;
  /**
   * Called ONLY when the value changed and is non-empty. The component exits
   * edit mode immediately (optimistic) and delegates persistence - pair it
   * with an optimistic cache update + the global error toast.
   */
  onSave: (nextValue: string) => void | Promise<void>;
  /** Accessible name of the field, e.g. "board name" */
  label: string;
  className?: string;
  inputClassName?: string;
  maxLength?: number;
  disabled?: boolean;
}

/**
 * Click-to-edit text: renders as text, becomes an input on click.
 * Enter or blur commit; Escape cancels; empty or unchanged = cancel.
 */
export function InlineEditText({
  value,
  onSave,
  label,
  className,
  inputClassName,
  maxLength,
  disabled = false,
}: InlineEditTextProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Enter commits AND can fire blur when the input unmounts in some
  // browsers - this ref prevents the double commit.
  const finishedRef = useRef(false);

  function startEditing(): void {
    if (disabled) return;
    finishedRef.current = false;
    setDraft(value);
    setEditing(true);
  }

  function commit(): void {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setEditing(false);

    const next = draft.trim();
    if (next === "" || next === value) return; // empty or unchanged -> cancel
    void onSave(next);
  }

  function cancel(): void {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setEditing(false);
    setDraft(value);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        disabled={disabled}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        className={cn(
          "group -mx-1.5 -my-1 inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-left",
          "hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          "disabled:opacity-50",
          className,
        )}
      >
        <span>{value}</span>
        {/* pencil only on hover/focus; inline SVG to avoid icon-lib assumptions */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
    );
  }

  return (
    <input
      autoFocus
      // select-all on focus: typing replaces the whole name
      onFocus={(e) => {
        e.currentTarget.select();
      }}
      value={draft}
      maxLength={maxLength}
      aria-label={label}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault(); // in case it ever lives inside a <form>
          commit();
        } else if (e.key === "Escape") {
          e.stopPropagation(); // don't close surrounding panels/dialogs
          cancel();
        }
      }}
      className={cn(
        "-mx-1.5 -my-1 rounded border-0 bg-transparent px-1.5 py-1",
        "focus:outline-none focus:ring-2 focus:ring-brand-500",
        className, // inherits the same typography as the text
        inputClassName,
      )}
    />
  );
}
