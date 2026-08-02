"use client";

import { type JSX, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import type { Label } from "@taskflow/database";
import { Button } from "@taskflow/ui";

interface TaskLabelsProps {
  orgLabels: Label[];
  taskLabelIds: string[];
  onAdd: (labelId: string) => void;
  onRemove: (labelId: string) => void;
}

/**
 * Label picker for a task.
 * Shows attached labels + a dropdown of all org labels to add/remove.
 * onAdd/onRemove are provided by the parent so this component stays pure.
 */
export function TaskLabels({
  orgLabels,
  taskLabelIds,
  onAdd,
  onRemove,
}: TaskLabelsProps): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const attached = orgLabels.filter((l) => taskLabelIds.includes(l.id));
  const available = orgLabels.filter((l) => !taskLabelIds.includes(l.id));

  const [prevAvailableCount, setPrevAvailableCount] = useState(available.length);
  if (prevAvailableCount !== available.length) {
    setPrevAvailableCount(available.length);
    if (available.length === 0) setPickerOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    if (!pickerOpen) return;

    function handleClick(e: MouseEvent): void {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [pickerOpen]);

  // Close on Escape
  useEffect(() => {
    if (!pickerOpen) return;

    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setPickerOpen(false);
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [pickerOpen]);

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-gray-700">Labels</h4>

      <div className="flex flex-wrap gap-1.5">
        {attached.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove label ${label.name}`}
              onClick={() => {
                onRemove(label.id);
              }}
              className="h-4 w-4 p-0 text-white hover:bg-white/20 hover:text-white"
            >
              <X className="h-3 w-3" />
            </Button>
          </span>
        ))}

        {available.length > 0 && (
          <div ref={pickerRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Add label"
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              onClick={() => {
                setPickerOpen((p) => !p);
              }}
              className="h-6 gap-1 rounded-full border border-dashed border-gray-300
                         px-2 text-xs text-gray-400 hover:border-brand-400
                         hover:bg-transparent hover:text-brand-600"
            >
              <Plus className="h-3 w-3" />
            </Button>

            {pickerOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-md
                           border border-gray-200 bg-white py-1 shadow-md"
              >
                {available.map((label) => (
                  <Button
                    key={label.id}
                    role="menuitem"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Stays open on purpose: add several labels in a row.
                      // It closes on outside click, Escape, or when the
                      // last available label is added (wrapper unmounts).
                      onAdd(label.id);
                    }}
                    className="w-full justify-start gap-2 rounded-none px-3 text-xs"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
