"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Plus } from "lucide-react";
import { Button, Input } from "@taskflow/ui";

interface AddTaskButtonProps {
  onAdd: (title: string) => void;
  loading?: boolean;
  /** Tasks in this column - when it grows while the input is open, the
   * control follows itself down the column's internal scroll. */
  taskCount: number;
}

/**
 * Inline "add task" control at the bottom of a Kanban column.
 * Collapses to a ghost button when not active.
 */
export function AddTaskButton({
  onAdd,
  loading = false,
  taskCount,
}: AddTaskButtonProps): JSX.Element {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adding) return;
    // rootRef is always attached by the time this effect runs (React commits
    // the DOM before effects fire), so `.current` is never null here.
    /* v8 ignore next */
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [adding, taskCount]);

  function submit(): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  }

  if (!adding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setAdding(true);
        }}
        className="w-full justify-start gap-1.5 text-xs text-gray-400
                   hover:bg-gray-100 hover:text-gray-700"
        aria-label="Add task"
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <Input
        autoFocus
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setAdding(false);
            setTitle("");
          }
        }}
        onBlur={() => {
          if (!title.trim()) setAdding(false);
        }}
        placeholder="Task title"
        maxLength={255}
        className="text-sm"
      />
      <div className="flex gap-1.5">
        <Button size="sm" onClick={submit} loading={loading} disabled={!title.trim()}>
          Add
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setAdding(false);
            setTitle("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
