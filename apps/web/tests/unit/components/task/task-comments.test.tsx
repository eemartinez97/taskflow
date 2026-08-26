import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/date", () => ({ formatRelativeTime: () => "just now" }));
const mockSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
const stableSocketRef = { current: mockSocket };
vi.mock("@/lib/socket/socket-context", () => ({ useSocketRef: () => stableSocketRef }));
vi.mock("@/components/common/user-avatar", () => ({ UserAvatar: () => <div /> }));
import { api } from "@/lib/trpc/client";
import { TaskComments } from "@/components/task/task-comments";
import { SOCKET_EVENTS } from "@taskflow/shared";
import { getLastMockUtils, mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { mockAuthorizedUser, VALID_ORG_ID, VALID_PROJECT_ID } from "@/tests/support/fixtures";

function getTypingHandler(): (payload: { taskId: string; userId: string }) => void {
  const call = mockSocket.on.mock.calls.find(([event]) => event === SOCKET_EVENTS.TASK_TYPING);
  if (!call) throw new Error("TASK_TYPING handler was not registered");
  return call[1] as (payload: { taskId: string; userId: string }) => void;
}

describe("TaskComments", () => {
  it("renders loading state and empty state", () => {
    mockUseQuery(api.comments.list, undefined, { isPending: true });

    const { rerender } = render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText(/loading comments/i)).toBeInTheDocument();
    mockUseQuery(api.comments.list, []);
    rerender(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("renders comments and shows delete only for author", () => {
    const myComment = {
      id: "c1",
      body: "My comment",
      authorId: mockAuthorizedUser.id,
      author: mockAuthorizedUser,
      createdAt: new Date(),
    };
    const otherComment = {
      id: "c2",
      body: "Other",
      authorId: "other",
      author: { id: "other", name: "Bob" },
      createdAt: new Date(),
    };
    mockUseQuery(api.comments.list, [myComment, otherComment]);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText("My comment")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /delete comment/i })).toHaveLength(1);
  });

  it("submits via Post button", () => {
    mockUseQuery(api.comments.list, []);
    const { mutateMock } = setupMutationMock(api.comments.create);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(input, { target: { value: "  Hello  " } });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({ body: "Hello" }));
  });

  it("toggles expand view", () => {
    mockUseQuery(api.comments.list, []);
    const onToggleExpand = vi.fn();
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={onToggleExpand}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /expand comments/i }));
    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("does not submit an empty body via Enter", () => {
    mockUseQuery(api.comments.list, []);
    const { mutateMock } = setupMutationMock(api.comments.create);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("renders the collapse icon and label when isExpanded is true", () => {
    mockUseQuery(api.comments.list, []);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /collapse comments/i })).toBeInTheDocument();
  });
});

describe("TaskComments - typing indicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 'Someone is typing…' for a matching taskId and clears it after the TTL", () => {
    mockUseQuery(api.comments.list, []);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    act(() => {
      getTypingHandler()({ taskId: "t1", userId: "u1" });
    });
    expect(screen.getByText(/someone is typing/i)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByText(/someone is typing/i)).not.toBeInTheDocument();
  });

  it("ignores TASK_TYPING events for a different taskId", () => {
    mockUseQuery(api.comments.list, []);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    act(() => {
      getTypingHandler()({ taskId: "other-task", userId: "u1" });
    });
    expect(screen.queryByText(/typing/i)).not.toBeInTheDocument();
  });

  it("shows 'Several people are typing…' for two distinct users", () => {
    mockUseQuery(api.comments.list, []);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    act(() => {
      getTypingHandler()({ taskId: "t1", userId: "u1" });
      getTypingHandler()({ taskId: "t1", userId: "u2" });
    });
    expect(screen.getByText(/several people are typing/i)).toBeInTheDocument();
  });

  it("cleans up socket listeners and timers on unmount", () => {
    mockUseQuery(api.comments.list, []);
    const { unmount } = render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    act(() => {
      getTypingHandler()({ taskId: "t1", userId: "u1" });
    });
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_TYPING, expect.any(Function));
  });

  it("does not duplicate the same user id when TASK_TYPING repeats before the TTL", () => {
    mockUseQuery(api.comments.list, []);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    act(() => {
      getTypingHandler()({ taskId: "t1", userId: "u1" });
      getTypingHandler()({ taskId: "t1", userId: "u1" });
    });
    expect(screen.getByText(/someone is typing/i)).toBeInTheDocument();
  });
});

describe("TaskComments - typing broadcast throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits TASK_TYPING throttled to once per second while typing", () => {
    mockUseQuery(api.comments.list, []);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(input, { target: { value: "h" } });
    fireEvent.change(input, { target: { value: "he" } });
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    fireEvent.change(input, { target: { value: "hel" } });
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
  });
});

describe("TaskComments - submit via Enter / Shift+Enter", () => {
  it("does not submit when Shift+Enter is pressed", () => {
    mockUseQuery(api.comments.list, []);
    const { mutateMock } = setupMutationMock(api.comments.create);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(input, { target: { value: "line one" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("submits on plain Enter", () => {
    mockUseQuery(api.comments.list, []);
    const { mutateMock } = setupMutationMock(api.comments.create);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({ body: "Hello" }));
  });
});

describe("TaskComments - cache updaters and delete-own-comment", () => {
  it("appends a new comment via the setData updater, deduping an existing id", () => {
    mockUseQuery(api.comments.list, []);
    const { triggerSuccess } = setupMutationMock(api.comments.create);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    const utils = getLastMockUtils();

    const newComment = { id: "c1", body: "Hi", authorId: "u1" };
    act(() => {
      triggerSuccess(newComment);
    });
    const updater = utils.comments.list.setData.mock.calls[0]?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater(undefined)).toEqual([newComment]);
    expect(updater([newComment])).toEqual([newComment]);
    expect(updater([{ id: "c0" }])).toEqual([{ id: "c0" }, newComment]);
  });

  it("removes a comment via the setData updater on delete success", () => {
    mockUseQuery(api.comments.list, []);
    const { triggerSuccess } = setupMutationMock(api.comments.delete);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    const utils = getLastMockUtils();

    act(() => {
      triggerSuccess(undefined, { commentId: "c1" });
    });
    const updater = utils.comments.list.setData.mock.calls[0]?.[1] as (
      prev: { id: string }[] | undefined,
    ) => unknown[];
    expect(updater(undefined)).toEqual([]);
    expect(updater([{ id: "c1" }, { id: "c2" }])).toEqual([{ id: "c2" }]);
  });

  it("deletes a comment via its own delete button when authored by the current user", async () => {
    const myComment = {
      id: "c1",
      body: "Mine",
      authorId: mockAuthorizedUser.id,
      author: mockAuthorizedUser,
      createdAt: new Date(),
    };
    mockUseQuery(api.comments.list, [myComment]);
    const { mutateMock } = setupMutationMock(api.comments.delete);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={true}
        onToggleExpand={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /delete comment/i }));
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: VALID_ORG_ID,
        projectId: VALID_PROJECT_ID,
        commentId: "c1",
      }),
    );
  });
});

describe("TaskComments - read-only (canEdit=false)", () => {
  it("hides the composer and the delete button even for the caller's own comment", () => {
    const myComment = {
      id: "c1",
      body: "Mine",
      authorId: mockAuthorizedUser.id,
      author: mockAuthorizedUser,
      createdAt: new Date(),
    };
    mockUseQuery(api.comments.list, [myComment]);
    render(
      <TaskComments
        orgId={VALID_ORG_ID}
        projectId={VALID_PROJECT_ID}
        taskId="t1"
        isExpanded={false}
        canEdit={false}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete comment/i })).not.toBeInTheDocument();
  });
});
