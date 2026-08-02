import type { JSX } from "react";
import { MousePointer2 } from "lucide-react";

import type { SocketCursor, SocketPresenceUser } from "@taskflow/shared";
import { cn } from "@taskflow/ui";

/** A live peer cursor payload (userId + coords + optional columnId). */
export type LiveCursor = SocketCursor;

const FALLBACK_COLOR = "#6366F1";

/** Icon + label footprint reserved before flipping the label to the other side. */
const LABEL_RESERVE_PX = 140;

/**
 * Whether the name label should render to the LEFT of the icon instead of
 * the default right side.
 *
 * Root cause this exists for: each column (and the board) clips its cursor
 * layer with overflow-hidden to avoid inflating scroll size (see
 * kanban-column.tsx). The label extends to the right of the (x, y) anchor by
 * default, so near a container's right edge it gets progressively clipped by
 * that boundary - even though the anchor point itself is still fully inside.
 * Flipping the label to grow LEFTWARD (into space that's already visible)
 * avoids the clip entirely, without needing to measure the label's actual
 * rendered text width.
 */
export function shouldFlipCursorLabel(x: number, containerWidth: number): boolean {
  if (containerWidth <= 0) return false;
  return x > containerWidth - LABEL_RESERVE_PX;
}

/**
 * Single, absolutely-positioned live cursor. The (x, y) anchor never moves
 * regardless of `flip` - only the label's attachment side changes, so the
 * icon position stays pixel-accurate to the broadcast coordinates.
 */
export function CursorPointer({
  cursor,
  meta,
  flip = false,
}: {
  cursor: LiveCursor;
  meta: SocketPresenceUser | undefined;
  flip?: boolean;
}): JSX.Element {
  const color = meta?.color ?? FALLBACK_COLOR;

  return (
    <div
      className="pointer-events-none absolute opacity-70"
      style={{ left: cursor.x, top: cursor.y, transform: "translate(-2px, -2px)" }}
    >
      <div className="relative">
        <MousePointer2 className="h-4 w-4 drop-shadow-sm" style={{ color, fill: color }} />
        {meta?.name && (
          <span
            className={cn(
              "absolute top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium",
              "text-white shadow-sm",
              flip ? "right-full mr-1" : "left-full ml-1",
            )}
            style={{ backgroundColor: color }}
          >
            {meta.name}
          </span>
        )}
      </div>
    </div>
  );
}
