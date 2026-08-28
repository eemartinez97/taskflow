"use client";

import type { JSX } from "react";

interface TaskCommentComposerProps {
  body: string;
  setBody: (value: string) => void;
  submit: () => void;
  notifyTyping: () => void;
  typingUserIds: string[];
  isPosting: boolean;
}

/**
 * The always-visible half of the task comments feature - pinned in
 * task-detail-panel.tsx's fixed footer (a sibling of the scrollable body,
 * not inside it), so it's reachable without scrolling the panel regardless
 * of how much form content or how long the comment thread is. See
 * use-task-comments.ts's docblock for why this is a separate component
 * from task-comments-list.tsx instead of the two being one.
 *
 * Enter submits, Shift+Enter inserts a newline (chat-app convention). No
 * separate Post button - desktop-only app (no mobile/touch target to
 * support), so the textarea alone is the whole composer.
 */
export function TaskCommentComposer({
  body,
  setBody,
  submit,
  notifyTyping,
  typingUserIds,
  isPosting,
}: TaskCommentComposerProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {/* Reserve a fixed-height line so the textarea never shifts when the
          indicator appears/disappears. Sits directly under the border with
          no extra top padding on the footer (see task-detail-panel.tsx) -
          this line's own height plus the gap below it is what gives the
          textarea the same breathing room above as it has below. */}
      <p aria-live="polite" className="h-4 text-xs italic text-gray-400">
        {typingUserIds.length === 0
          ? ""
          : typingUserIds.length === 1
            ? "Someone is typing…"
            : "Several people are typing…"}
      </p>

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          notifyTyping();
        }}
        placeholder="Add a comment..."
        rows={2}
        disabled={isPosting}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="w-full resize-none rounded-md border border-gray-300 px-3 py-1.5 text-sm
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                   disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
