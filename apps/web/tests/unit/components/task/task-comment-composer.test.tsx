import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskCommentComposer } from "@/components/task/task-comment-composer";

function baseProps(overrides: Partial<Parameters<typeof TaskCommentComposer>[0]> = {}) {
  return {
    body: "",
    setBody: vi.fn(),
    submit: vi.fn(),
    notifyTyping: vi.fn(),
    typingUserIds: [] as string[],
    isPosting: false,
    ...overrides,
  };
}

describe("TaskCommentComposer", () => {
  it("renders the textarea", () => {
    render(<TaskCommentComposer {...baseProps()} />);
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
  });

  it("disables the textarea while a post is in flight", () => {
    render(<TaskCommentComposer {...baseProps({ isPosting: true })} />);
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeDisabled();
  });

  it("calls setBody and notifyTyping on every input change", () => {
    const setBody = vi.fn();
    const notifyTyping = vi.fn();
    render(<TaskCommentComposer {...baseProps({ setBody, notifyTyping })} />);
    fireEvent.change(screen.getByPlaceholderText(/add a comment/i), {
      target: { value: "hi" },
    });
    expect(setBody).toHaveBeenCalledWith("hi");
    expect(notifyTyping).toHaveBeenCalledOnce();
  });

  it("submits on plain Enter", () => {
    const submit = vi.fn();
    render(<TaskCommentComposer {...baseProps({ body: "Hello", submit })} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/add a comment/i), { key: "Enter" });
    expect(submit).toHaveBeenCalledOnce();
  });

  it("does not submit on Shift+Enter (multiline)", () => {
    const submit = vi.fn();
    render(<TaskCommentComposer {...baseProps({ body: "Hello", submit })} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/add a comment/i), {
      key: "Enter",
      shiftKey: true,
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("shows nothing when no one is typing", () => {
    render(<TaskCommentComposer {...baseProps({ typingUserIds: [] })} />);
    expect(screen.queryByText(/typing/i)).not.toBeInTheDocument();
  });

  it("shows 'Someone is typing…' for one typing user", () => {
    render(<TaskCommentComposer {...baseProps({ typingUserIds: ["u1"] })} />);
    expect(screen.getByText(/someone is typing/i)).toBeInTheDocument();
  });

  it("shows 'Several people are typing…' for two or more typing users", () => {
    render(<TaskCommentComposer {...baseProps({ typingUserIds: ["u1", "u2"] })} />);
    expect(screen.getByText(/several people are typing/i)).toBeInTheDocument();
  });
});
