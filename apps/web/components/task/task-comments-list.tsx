"use client";

import { useEffect, useRef, type JSX } from "react";
import { Maximize2, Minimize2, Trash2 } from "lucide-react";
import { Button } from "@taskflow/ui";
import type { CommentWithAuthor } from "@taskflow/database";

import { UserAvatar } from "../common/user-avatar";
import { displayName } from "@/lib/utils/user";
import { formatRelativeTime } from "@/lib/utils/date";

interface TaskCommentsListProps {
  comments: CommentWithAuthor[];
  isPending: boolean;
  sessionUserId: string | undefined;
  isExpanded: boolean;
  /** False for VIEWER - hides delete controls (the server rejects it too). */
  canEdit: boolean;
  onToggleExpand: () => void;
  onDelete: (commentId: string) => void;
}

/**
 * The scrollable half of the task comments feature - header, expand
 * toggle, and the comment thread itself. Lives inline in
 * task-detail-panel.tsx's scrollable body. The composer (input + Post
 * button) is a SEPARATE component, task-comment-composer.tsx, rendered in
 * the panel's fixed footer instead - see use-task-comments.ts's docblock
 * for why the two were split out of a single component.
 */
export function TaskCommentsList({
  comments,
  isPending,
  sessionUserId,
  isExpanded,
  canEdit,
  onToggleExpand,
  onDelete,
}: TaskCommentsListProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest comment in view - comments are appended to the end of
  // the array, so scrolling to the bottom on every new arrival surfaces it
  // without the user having to scroll the thread themselves.
  useEffect(() => {
    const el = scrollRef.current;
    /* v8 ignore next -- only runs after this component has committed its (unconditional) scroll container div, so the ref is always attached */
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Comments</h4>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isExpanded ? "Collapse comments" : "Expand comments"}
          title={isExpanded ? "Collapse comments" : "Expand comments"}
          onClick={onToggleExpand}
          className="h-6 w-6 text-gray-400 hover:text-gray-600"
        >
          {isExpanded ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isPending && <p className="text-xs text-gray-400">Loading comments...</p>}
        {!isPending && comments.length === 0 && (
          <p className="text-xs text-gray-400">No comments yet.</p>
        )}

        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className="group flex items-start gap-2 rounded-md bg-gray-50 p-2">
              <UserAvatar user={comment.author} size="sm" className="mt-0.5" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-semibold text-gray-800">
                    {displayName(comment.author)}
                  </span>
                  <span className="shrink-0 text-[11px] text-gray-400">
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
              </div>

              {/* Only the author can delete - the server enforces it too, and
                  also rejects VIEWER outright regardless of authorship */}
              {canEdit && sessionUserId === comment.authorId && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete comment"
                  onClick={() => {
                    onDelete(comment.id);
                  }}
                  className="h-6 w-6 shrink-0 text-gray-300 opacity-0 hover:text-red-500
                             focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
