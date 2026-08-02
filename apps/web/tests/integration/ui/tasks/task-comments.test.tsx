import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { TaskComments } from "@/components/task/task-comments";
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

// -- Helpers --
let createMutation: ReturnType<typeof wireCapturableMutation>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;

function setupCommentsQuery(comments: MockComment[]): void {
  mockUseQuery(api.comments.list, comments);
}

function buildProps(overrides: Partial<Parameters<typeof TaskComments>[0]> = {}) {
  return {
    orgId: "org-1",
    projectId: "proj-1",
    taskId: "task-1",
    isExpanded: false,
    onToggleExpand: vi.fn(),
    ...overrides,
  };
}

// -- Tests --
describe("TaskComments", () => {
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
    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.getByText("Comments")).toBeInTheDocument();
  });

  it("renders the expand/collapse toggle button", () => {
    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.getByRole("button", { name: /expand comments/i })).toBeInTheDocument();
  });

  it("renders the 'No comments yet.' message when the list is empty", () => {
    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders the loading state when the query is pending", () => {
    mockUseQuery(api.comments.list, undefined, {
      isLoading: true,
      isPending: true,
      isFetching: true,
      isSuccess: false,
    });

    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.getByText(/loading comments/i)).toBeInTheDocument();
  });

  it("renders each comment body and author name", () => {
    setupCommentsQuery([OWN_COMMENT, OTHER_COMMENT]);
    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.getByText("Looks like a JWT issue.")).toBeInTheDocument();
    expect(screen.getByText("I can reproduce this.")).toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
  });

  // -- Expand / collapse --

  it("calls onToggleExpand when the toggle button is clicked", () => {
    const mockToggle = vi.fn();
    renderUI(<TaskComments {...buildProps({ onToggleExpand: mockToggle })} />);

    fireEvent.click(screen.getByRole("button", { name: /expand comments/i }));

    expect(mockToggle).toHaveBeenCalledOnce();
  });

  it("renders 'Collapse comments' aria-label when isExpanded is true", () => {
    renderUI(<TaskComments {...buildProps({ isExpanded: true })} />);

    expect(screen.getByRole("button", { name: /collapse comments/i })).toBeInTheDocument();
  });

  // -- Post a comment --

  it("calls createMutation.mutate with the trimmed body when the Post button is clicked", () => {
    renderUI(<TaskComments {...buildProps()} />);

    fireEvent.change(screen.getByPlaceholderText("Add a comment..."), {
      target: { value: "  Great find!  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(createMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: "proj-1",
      taskId: "task-1",
      body: "Great find!",
    });
  });

  it("calls createMutation.mutate when Enter is pressed in the comment input", () => {
    renderUI(<TaskComments {...buildProps()} />);

    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.change(input, { target: { value: "Nice work" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(createMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Nice work" }),
    );
  });

  it("does NOT call createMutation.mutate when Enter+Shift is pressed (multiline)", () => {
    renderUI(<TaskComments {...buildProps()} />);

    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.change(input, { target: { value: "Line 1" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  it("does NOT call createMutation.mutate when the input is empty", () => {
    renderUI(<TaskComments {...buildProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  it("disables the Post button when the comment input is empty", () => {
    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
  });

  // -- Delete a comment --

  it("renders a Delete comment button only for the current user's own comment", () => {
    setupCommentsQuery([OWN_COMMENT, OTHER_COMMENT]);
    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.getAllByRole("button", { name: /delete comment/i })).toHaveLength(1);
  });

  it("calls deleteMutation.mutate with the correct ids when Delete is clicked", () => {
    setupCommentsQuery([OWN_COMMENT]);
    renderUI(<TaskComments {...buildProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: "proj-1",
      commentId: OWN_COMMENT.id,
    });
  });

  it("does NOT render a Delete button for another user's comment", () => {
    setupCommentsQuery([OTHER_COMMENT]);
    renderUI(<TaskComments {...buildProps()} />);

    expect(screen.queryByRole("button", { name: "Delete comment" })).not.toBeInTheDocument();
  });

  // -- Socket: typing indicator --

  it("shows 'Someone is typing…' when one user sends a typing event for this task", async () => {
    const { useSocketRef } = await import("@/lib/socket/socket-context");
    vi.mocked(useSocketRef).mockReturnValue(mockSocketRef);

    renderUI(<TaskComments {...buildProps()} />);

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

    renderUI(<TaskComments {...buildProps()} />);

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

    renderUI(<TaskComments {...buildProps({ taskId: "task-1" })} />);

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

    renderUI(<TaskComments {...buildProps()} />);

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

    renderUI(<TaskComments {...buildProps()} />);

    // Socket's on() should not have been called since socketRef is null
    expect(mockSocket.on).not.toHaveBeenCalled();
  });
});
