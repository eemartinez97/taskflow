import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/date", () => ({ formatRelativeTime: () => "just now" }));
vi.mock("@/components/common/user-avatar", () => ({ UserAvatar: () => <div /> }));

import { TaskCommentsList } from "@/components/task/task-comments-list";
import { mockAuthorizedUser } from "@/tests/support/fixtures";

function baseProps(overrides: Partial<Parameters<typeof TaskCommentsList>[0]> = {}) {
  return {
    comments: [],
    isPending: false,
    sessionUserId: mockAuthorizedUser.id,
    isExpanded: false,
    canEdit: true,
    onToggleExpand: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe("TaskCommentsList", () => {
  it("renders the loading state", () => {
    render(<TaskCommentsList {...baseProps({ isPending: true })} />);
    expect(screen.getByText(/loading comments/i)).toBeInTheDocument();
  });

  it("renders the empty state", () => {
    render(<TaskCommentsList {...baseProps({ comments: [] })} />);
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("renders comments and shows delete only for the current user's own comment", () => {
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
    render(<TaskCommentsList {...baseProps({ comments: [myComment, otherComment] as never })} />);
    expect(screen.getByText("My comment")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /delete comment/i })).toHaveLength(1);
  });

  it("hides delete for everyone when canEdit is false, even the caller's own comment", () => {
    const myComment = {
      id: "c1",
      body: "Mine",
      authorId: mockAuthorizedUser.id,
      author: mockAuthorizedUser,
      createdAt: new Date(),
    };
    render(<TaskCommentsList {...baseProps({ comments: [myComment] as never, canEdit: false })} />);
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete comment/i })).not.toBeInTheDocument();
  });

  it("calls onDelete with the comment id when its delete button is clicked", async () => {
    const myComment = {
      id: "c1",
      body: "Mine",
      authorId: mockAuthorizedUser.id,
      author: mockAuthorizedUser,
      createdAt: new Date(),
    };
    const onDelete = vi.fn();
    render(<TaskCommentsList {...baseProps({ comments: [myComment] as never, onDelete })} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /delete comment/i }));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("toggles expand view and shows the collapse label/icon when isExpanded is true", () => {
    const onToggleExpand = vi.fn();
    render(<TaskCommentsList {...baseProps({ onToggleExpand })} />);
    fireEvent.click(screen.getByRole("button", { name: /expand comments/i }));
    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("renders the collapse icon and label when isExpanded is true", () => {
    render(<TaskCommentsList {...baseProps({ isExpanded: true })} />);
    expect(screen.getByRole("button", { name: /collapse comments/i })).toBeInTheDocument();
  });

  it("scrolls the thread to the bottom when a new comment arrives", () => {
    const { rerender } = render(<TaskCommentsList {...baseProps({ comments: [] })} />);
    const scrollContainer = screen.getByText(/no comments yet/i).parentElement as HTMLDivElement;
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 500, configurable: true });
    scrollContainer.scrollTop = 0;

    const myComment = {
      id: "c1",
      body: "New",
      authorId: mockAuthorizedUser.id,
      author: mockAuthorizedUser,
      createdAt: new Date(),
    };
    rerender(<TaskCommentsList {...baseProps({ comments: [myComment] as never })} />);

    expect(scrollContainer.scrollTop).toBe(500);
  });
});
