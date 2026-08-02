"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Maximize2, Minimize2, Trash2 } from "lucide-react";
import { Button, Input } from "@taskflow/ui";
import { api } from "@/lib/trpc/client";
import { useSession } from "next-auth/react";
import { UserAvatar } from "../common/user-avatar";
import { displayName } from "@/lib/utils/user";
import { formatRelativeTime } from "@/lib/utils/date";
import { useSocketRef } from "@/lib/socket/socket-context";
import { SOCKET_EVENTS } from "@taskflow/shared";

interface TaskCommentsProps {
  orgId: string;
  projectId: string;
  taskId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function TaskComments({
  orgId,
  projectId,
  taskId,
  isExpanded,
  onToggleExpand,
}: TaskCommentsProps): JSX.Element {
  const [body, setBody] = useState("");
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const utils = api.useUtils();
  const socketRef = useSocketRef(); // null on /tasks - typing is board-only
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    // No "stopped typing" event exists: each ping refreshes a 3s timer.
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const onTyping = ({
      taskId: eventTaskId,
      userId,
    }: {
      taskId: string;
      userId: string;
    }): void => {
      if (eventTaskId !== taskId) return;

      setTypingUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));

      clearTimeout(timers.get(userId));
      timers.set(
        userId,
        setTimeout(() => {
          setTypingUserIds((prev) => prev.filter((id) => id !== userId));
          timers.delete(userId);
        }, 3000),
      );
    };

    socket.on(SOCKET_EVENTS.TASK_TYPING, onTyping);

    return () => {
      socket.off(SOCKET_EVENTS.TASK_TYPING, onTyping);
      for (const timer of timers.values()) clearTimeout(timer);
      setTypingUserIds([]);
    };
  }, [socketRef, taskId]);

  const { data: session } = useSession();

  const { data: comments = [], isPending } = api.comments.list.useQuery({ orgId, taskId });

  const createMutation = api.comments.create.useMutation({
    onSuccess: (newComment) => {
      utils.comments.list.setData({ orgId, taskId }, (prev) => {
        const existing = prev ?? [];
        if (existing.some((c) => c.id === newComment.id)) return existing;
        return [...(prev ?? []), newComment];
      });
      setBody("");
    },
  });

  const deleteMutation = api.comments.delete.useMutation({
    onSuccess: (_result, { commentId }) => {
      utils.comments.list.setData({ orgId, taskId }, (prev) =>
        (prev ?? []).filter((c) => c.id !== commentId),
      );
    },
  });

  /** Throttled to one ping per second - the server relays every packet. */
  function notifyTyping(): void {
    const socket = socketRef?.current;
    const now = Date.now();

    if (!socket || now - lastTypingSentRef.current < 1000) return;

    lastTypingSentRef.current = now;
    socket.emit(SOCKET_EVENTS.TASK_TYPING, { taskId, userId: "" }); // server overwrites userId
  }

  /**
   * Single submit path - the Enter handler and the Post button used to
   * duplicate the same trimming + mutate call.
   */
  function submit(): void {
    const trimmed = body.trim();
    if (!trimmed) return;
    createMutation.mutate({ orgId, projectId, taskId, body: trimmed });
  }

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

      {/* Scrollable comment list - the only flexible region. The input below
          stays pinned (shrink-0) so it's always reachable without hunting
          for it after scrolling through a long thread. */}
      <div className="min-h-[120px] flex-1 overflow-y-auto pr-1">
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

              {/* Only the author can delete - the server enforces it too */}
              {session?.user.id === comment.authorId && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete comment"
                  onClick={() => {
                    deleteMutation.mutate({ orgId, projectId, commentId: comment.id });
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

      {/* Pinned composer - always reachable, never pushed off-screen by a
          long comment thread. */}
      <div className="mt-2 flex shrink-0 flex-col gap-1 border-t border-gray-100 pt-2">
        {/* Reserve a fixed-height line so the input never shifts when the
            indicator appears/disappears. */}
        <p aria-live="polite" className="h-4 text-xs italic text-gray-400">
          {typingUserIds.length === 0
            ? ""
            : typingUserIds.length === 1
              ? "Someone is typing…"
              : "Several people are typing…"}
        </p>

        <div className="flex gap-2">
          <Input
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              notifyTyping();
            }}
            placeholder="Add a comment..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="text-sm"
          />
          <Button onClick={submit} loading={createMutation.isPending} disabled={!body.trim()}>
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
