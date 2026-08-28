import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { useTaskComments } from "@/lib/hooks/use-task-comments";
import { TaskCommentsList } from "@/components/task/task-comments-list";
import { TaskCommentComposer } from "@/components/task/task-comment-composer";
import { api } from "@/lib/trpc/client";
import { mockSession } from "@/tests/mocks/next-auth";
import { mockSocket, resetHandlerStore, triggerSocketEvent } from "@/tests/mocks/socket-io-client";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";

// -- Module mocks --

vi.mock("@/components/common/user-avatar", () => ({
  UserAvatar: ({ user }: { user: { name?: string | null } }) => (
    <span data-testid="comment-avatar">{user.name ?? "?"}</span>
  ),
}));

const mockSocketRef = { current: mockSocket as never };

vi.mock("@/lib/socket/socket-context", () => ({
  useSocketRef: vi.fn(() => null), // no socket by default (not on a board)
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// -- Fixtures --
interface MockComment {
  id: string;
  body: string;
  authorId: string;
  taskId: string;
  createdAt: Date;
  author: { id: string; name: string | null; email: string };
}

const CURRENT_USER_ID = mockSession.user.id;

const OWN_COMMENT: MockComment = {
  id: "comment-1",
  body: "Looks like a JWT issue.",
  authorId: CURRENT_USER_ID,
  taskId: "task-1",
  createdAt: new Date("2024-03-01"),
  author: { id: CURRENT_USER_ID, name: "Alice", email: "alice@taskflow.dev" },
};

const OTHER_COMMENT: MockComment = {
  id: "comment-2",
  body: "I can reproduce this.",
  authorId: "other-user-id",
  taskId: "task-1",
  createdAt: new Date("2024-03-01"),
  author: { id: "other-user-id", name: "Bob", email: "bob@taskflow.dev" },
};

/**
 * Combines the hook with both presentational halves, exactly how
 * task-detail-panel.tsx wires them (list inline, composer in its own
 * section) - see use-task-comments.ts's docblock for why the feature is
 * split across three files instead of one.
 */
function TaskCommentsHarness({
  taskId = "task-1",
  isExpanded = false,
  canEdit = true,
  onToggleExpand = vi.fn(),
}: {
  taskId?: string;
  isExpanded?: boolean;
  canEdit?: boolean;
  onToggleExpand?: () => void;
}) {
  const comments = useTaskComments({ orgId: "org-1", projectId: "proj-1", taskId });
  return (
    <>
      <TaskCommentsList
        comments={comments.comments}
        isPending={comments.isPending}
        sessionUserId={comments.sessionUserId}
        isExpanded={isExpanded}
        canEdit={canEdit}
        onToggleExpand={onToggleExpand}
        onDelete={comments.deleteComment}
      />
      {canEdit && (
        <TaskCommentComposer
          body={comments.body}
          setBody={comments.setBody}
          submit={comments.submit}
          notifyTyping={comments.notifyTyping}
          typingUserIds={comments.typingUserIds}
          isPosting={comments.isPosting}
        />
      )}
    </>
  );
}

// -- Helpers --
let createMutation: ReturnType<typeof wireCapturableMutation>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;

function setupCommentsQuery(comments: MockComment[]): void {
  mockUseQuery(api.comments.list, comments);
}

// -- Tests --
describe("Task comments (list + composer)", () => {
  beforeEach(() => {
    resetHandlerStore();
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: vi.fn(),
    });

    setupCommentsQuery([]);

    createMutation = wireCapturableMutation(api.comments.create);
    deleteMutation = wireCapturableMutation(api.comments.delete);

    mockApiUtils();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -- Rendering --

  it("renders the Comments heading", () => {
    renderUI(<TaskCommentsHarness />);

    expect(screen.getByText("Comments")).toBeInTheDocument();
  });

  it("renders the expand/collapse toggle button", () => {
    renderUI(<TaskCommentsHarness />);

    expect(screen.getByRole("button", { name: /expand comments/i })).toBeInTheDocument();
  });

  it("renders the 'No comments yet.' message when the list is empty", () => {
    renderUI(<TaskCommentsHarness />);

    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders the loading state when the query is pending", () => {
    mockUseQuery(api.comments.list, undefined, {
      isLoading: true,
      isPending: true,
      isFetching: true,
      isSuccess: false,
    });

    renderUI(<TaskCommentsHarness />);

    expect(screen.getByText(/loading comments/i)).toBeInTheDocument();
  });

  it("renders each comment body and author name", () => {
    setupCommentsQuery([OWN_COMMENT, OTHER_COMMENT]);
    renderUI(<TaskCommentsHarness />);

    expect(screen.getByText("Looks like a JWT issue.")).toBeInTheDocument();
    expect(screen.getByText("I can reproduce this.")).toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
  });

  // -- Expand / collapse --

  it("calls onToggleExpand when the toggle button is clicked", () => {
    const mockToggle = vi.fn();
    renderUI(<TaskCommentsHarness onToggleExpand={mockToggle} />);

    fireEvent.click(screen.getByRole("button", { name: /expand comments/i }));

    expect(mockToggle).toHaveBeenCalledOnce();
  });

  it("renders 'Collapse comments' aria-label when isExpanded is true", () => {
    renderUI(<TaskCommentsHarness isExpanded />);

    expect(screen.getByRole("button", { name: /collapse comments/i })).toBeInTheDocument();
  });

  // -- Post a comment --

  it("calls createMutation.mutate with the trimmed body when Enter is pressed", () => {
    renderUI(<TaskCommentsHarness />);

    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.change(input, { target: { value: "  Great find!  " } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(createMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: "proj-1",
      taskId: "task-1",
      body: "Great find!",
    });
  });

  it("does NOT call createMutation.mutate when Enter+Shift is pressed (multiline)", () => {
    renderUI(<TaskCommentsHarness />);

    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.change(input, { target: { value: "Line 1" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  it("does NOT call createMutation.mutate when Enter is pressed on an empty input", () => {
    renderUI(<TaskCommentsHarness />);
    fireEvent.keyDown(screen.getByPlaceholderText("Add a comment..."), {
      key: "Enter",
      shiftKey: false,
    });

    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Delete a comment --

  it("renders a Delete comment button only for the current user's own comment", () => {
    setupCommentsQuery([OWN_COMMENT, OTHER_COMMENT]);
    renderUI(<TaskCommentsHarness />);

    expect(screen.getAllByRole("button", { name: /delete comment/i })).toHaveLength(1);
  });

  it("calls deleteMutation.mutate with the correct ids when Delete is clicked", () => {
    setupCommentsQuery([OWN_COMMENT]);
    renderUI(<TaskCommentsHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: "proj-1",
      commentId: OWN_COMMENT.id,
    });
  });

  it("does NOT render a Delete button for another user's comment", () => {
    setupCommentsQuery([OTHER_COMMENT]);
    renderUI(<TaskCommentsHarness />);

    expect(screen.queryByRole("button", { name: "Delete comment" })).not.toBeInTheDocument();
  });

  // -- canEdit=false (VIEWER) --

  it("hides the composer entirely for a read-only viewer, even for the caller's own comment", () => {
    setupCommentsQuery([OWN_COMMENT]);
    renderUI(<TaskCommentsHarness canEdit={false} />);

    expect(screen.getByText(OWN_COMMENT.body)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete comment/i })).not.toBeInTheDocument();
  });

  // -- Socket: typing indicator --

  it("shows 'Someone is typing…' when one user sends a typing event for this task", async () => {
    const { useSocketRef } = await import("@/lib/socket/socket-context");
    vi.mocked(useSocketRef).mockReturnValue(mockSocketRef);

    renderUI(<TaskCommentsHarness />);

    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.TASK_TYPING, {
        taskId: "task-1",
        userId: "other-user-id",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Someone is typing…")).toBeInTheDocument();
    });
  });

  it("shows 'Several people are typing…' when two users are typing", async () => {
    const { useSocketRef } = await import("@/lib/socket/socket-context");
    vi.mocked(useSocketRef).mockReturnValue(mockSocketRef);

    renderUI(<TaskCommentsHarness />);

    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.TASK_TYPING, { taskId: "task-1", userId: "user-a" });
      triggerSocketEvent(SOCKET_EVENTS.TASK_TYPING, { taskId: "task-1", userId: "user-b" });
    });

    await waitFor(() => {
      expect(screen.getByText("Several people are typing…")).toBeInTheDocument();
    });
  });

  it("ignores typing events for a different taskId", async () => {
    const { useSocketRef } = await import("@/lib/socket/socket-context");
    vi.mocked(useSocketRef).mockReturnValue(mockSocketRef);

    renderUI(<TaskCommentsHarness taskId="task-1" />);

    triggerSocketEvent(SOCKET_EVENTS.TASK_TYPING, {
      taskId: "task-DIFFERENT",
      userId: "user-a",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/typing/i)).not.toBeInTheDocument();
  });

  it("clears the typing indicator after 3 seconds of inactivity", async () => {
    vi.useFakeTimers();
    const { useSocketRef } = await import("@/lib/socket/socket-context");
    vi.mocked(useSocketRef).mockReturnValue(mockSocketRef);

    renderUI(<TaskCommentsHarness />);

    act(() => {
      triggerSocketEvent(SOCKET_EVENTS.TASK_TYPING, { taskId: "task-1", userId: "user-a" });
    });
    expect(screen.getByText("Someone is typing…")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.queryByText("Someone is typing…")).not.toBeInTheDocument();
  });

  it("does NOT register socket handlers when useSocketRef returns null", async () => {
    const { useSocketRef } = await import("@/lib/socket/socket-context");
    vi.mocked(useSocketRef).mockReturnValue(null);

    renderUI(<TaskCommentsHarness />);

    // Socket's on() should not have been called since socketRef is null
    expect(mockSocket.on).not.toHaveBeenCalled();
  });
});
