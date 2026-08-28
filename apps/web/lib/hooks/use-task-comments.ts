"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import type { CommentWithAuthor } from "@taskflow/database";
import { SOCKET_EVENTS } from "@taskflow/shared";

import { api } from "@/lib/trpc/client";
import { useSocketRef } from "@/lib/socket/socket-context";

interface UseTaskCommentsArgs {
  orgId: string;
  projectId: string;
  taskId: string;
}

export interface UseTaskCommentsResult {
  comments: CommentWithAuthor[];
  isPending: boolean;
  sessionUserId: string | undefined;
  body: string;
  setBody: (value: string) => void;
  submit: () => void;
  notifyTyping: () => void;
  typingUserIds: string[];
  isPosting: boolean;
  deleteComment: (commentId: string) => void;
}

/**
 * Owns every piece of state/data behind the task comments feature - the
 * list query, create/delete mutations, and the typing-indicator socket
 * wiring. Extracted out of a single TaskComments component (which rendered
 * both the list AND the composer together) so the composer can be rendered
 * in a DIFFERENT part of the DOM tree - task-detail-panel.tsx's fixed
 * footer, always visible without scrolling the panel - while the list
 * still renders inline in the panel's scrollable body. See
 * components/task/task-comments-list.tsx and
 * components/task/task-comment-composer.tsx, the two presentational
 * components this hook now feeds.
 */
export function useTaskComments({
  orgId,
  projectId,
  taskId,
}: UseTaskCommentsArgs): UseTaskCommentsResult {
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

  return {
    comments,
    isPending,
    sessionUserId: session?.user.id,
    body,
    setBody,
    submit,
    notifyTyping,
    typingUserIds,
    isPosting: createMutation.isPending,
    deleteComment: (commentId: string) => {
      deleteMutation.mutate({ orgId, projectId, commentId });
    },
  };
}
