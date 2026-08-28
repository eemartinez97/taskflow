"use client";

import type { JSX } from "react";
import { useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button, cn } from "@taskflow/ui";
import { useEscapeKey } from "@/lib/hooks/use-escape-key";
import { useOutsideClick } from "@/lib/hooks/use-outside-click";

export interface DropdownItem {
  label: string;
  onClick: () => void;
  /** when true the item renders in red */
  danger?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

interface DropdownMenuProps {
  items: DropdownItem[];
  /** Accessible label for the trigger button */
  triggerLabel?: string;
  className?: string;
}

/**
 * 3-dot dropdown menu used on project cards, member rows, task cards, etc.
 *
 * Closes on outside-click and on Escape. Positioned relative to trigger.
 */

export function DropdownMenu({
  items,
  triggerLabel = "Open menu",
  className,
}: DropdownMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClick(containerRef, open, () => {
    setOpen(false);
  });

  useEscapeKey(open, () => {
    setOpen(false);
  });

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-50 mt-1 min-w-[150px] rounded-md border border-gray-200",
            "bg-white py-1 shadow-md",
          )}
        >
          {items.map((item) => (
            <Button
              key={item.label}
              role="menuitem"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "w-full justify-start whitespace-nowrap rounded-none px-3",
                item.danger && "text-red-600 hover:bg-red-50 hover:text-red-600",
              )}
            >
              {item.icon && <item.icon className="mr-2 h-4 w-4 shrink-0" />}
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
