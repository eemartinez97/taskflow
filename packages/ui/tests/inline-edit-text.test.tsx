import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InlineEditText } from "../src";
import type { ComponentProps } from "react";

/** Renders InlineEditText, clicks the edit button, and returns the resulting input. */
async function renderAndStartEditing(
  props: Partial<ComponentProps<typeof InlineEditText>> = {},
): Promise<HTMLElement> {
  render(<InlineEditText value="Old" onSave={vi.fn()} label="board name" {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "Edit board name" }));
  return screen.getByRole("textbox");
}

describe("InlineEditText", () => {
  it("renders the value as text by default", () => {
    render(<InlineEditText value="My Board" onSave={vi.fn()} label="board name" />);
    expect(screen.getByText("My Board")).toBeInTheDocument();
  });

  it("renders a button with accessible label to start editing", () => {
    render(<InlineEditText value="My Board" onSave={vi.fn()} label="board name" />);
    expect(screen.getByRole("button", { name: "Edit board name" })).toBeInTheDocument();
  });

  it("enters edit mode showing an input when clicked", async () => {
    await renderAndStartEditing({ value: "My Board" });
    expect(screen.getByRole("textbox", { name: "board name" })).toBeInTheDocument();
  });

  it("prefills the input with the current value", async () => {
    const input = await renderAndStartEditing({ value: "My Board" });
    expect(input).toHaveValue("My Board");
  });

  it("selects all text on focus so typing replaces the value", async () => {
    const input = (await renderAndStartEditing({ value: "Old Name" })) as HTMLInputElement;
    // jsdom doesn't fully implement selection, but selectionStart/End should be set
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("calls onSave with the new value when Enter is pressed", async () => {
    const onSave = vi.fn();
    const input = await renderAndStartEditing({ onSave });
    await userEvent.clear(input);
    await userEvent.type(input, "New Name{Enter}");
    expect(onSave).toHaveBeenCalledWith("New Name");
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("exits edit mode after committing with Enter", async () => {
    const onSave = vi.fn();
    const input = await renderAndStartEditing({ onSave });
    await userEvent.clear(input);
    await userEvent.type(input, "New{Enter}");
    // Back to button mode
    expect(screen.getByRole("button", { name: "Edit board name" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("calls onSave when input loses focus (blur commit)", async () => {
    const onSave = vi.fn();
    render(
      <div>
        <InlineEditText value="Old" onSave={onSave} label="board name" />
        <button>Outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit board name" }));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Blurred Value");
    await userEvent.click(screen.getByRole("button", { name: "Outside" }));
    expect(onSave).toHaveBeenCalledWith("Blurred Value");
  });

  it("does NOT call onSave when value is unchanged and Enter is pressed", async () => {
    const onSave = vi.fn();
    await renderAndStartEditing({ value: "Same", onSave });
    await userEvent.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does NOT call onSave when value is empty and Enter is pressed", async () => {
    const onSave = vi.fn();
    const input = await renderAndStartEditing({ value: "Original", onSave });
    await userEvent.clear(input);
    await userEvent.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels editing and reverts value when Escape is pressed", async () => {
    const onSave = vi.fn();
    const input = await renderAndStartEditing({ value: "Original", onSave });
    await userEvent.clear(input);
    await userEvent.type(input, "Discarded");
    await userEvent.keyboard("{Escape}");
    expect(onSave).not.toHaveBeenCalled();
    // Back to button mode showing original value
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("trims whitespace before comparing and saving", async () => {
    const onSave = vi.fn();
    const input = await renderAndStartEditing({ value: "Original", onSave });
    await userEvent.clear(input);
    await userEvent.type(input, "   NewValue   {Enter}");
    expect(onSave).toHaveBeenCalledWith("NewValue");
  });

  it("does NOT call onSave when only whitespace is entered (trims to empty)", async () => {
    const onSave = vi.fn();
    const input = await renderAndStartEditing({ value: "Original", onSave });
    await userEvent.clear(input);
    await userEvent.type(input, "     {Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not enter edit mode when disabled", async () => {
    const onSave = vi.fn();
    render(<InlineEditText value="Locked" onSave={onSave} label="board name" disabled />);
    const button = screen.getByRole("button", { name: "Edit board name" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not double-commit when Enter is followed by blur", async () => {
    const onSave = vi.fn();
    render(
      <div>
        <InlineEditText value="Old" onSave={onSave} label="board name" />
        <button>Outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit board name" }));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "NewValue");
    await userEvent.keyboard("{Enter}");
    // After Enter, the input unmounts; clicking outside should not trigger another save
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not double-commit when blur is followed by another event", async () => {
    const onSave = vi.fn();
    render(
      <div>
        <InlineEditText value="Old" onSave={onSave} label="board name" />
        <button>Outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit board name" }));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "BlurValue");
    // Blur commits
    act(() => {
      input.blur();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("applies maxLength to the input", async () => {
    const input = await renderAndStartEditing({ value: "Ab", maxLength: 5 });
    expect(input).toHaveAttribute("maxlength", "5");
  });

  it("applies custom className to the display button", () => {
    render(
      <InlineEditText
        value="Test"
        onSave={vi.fn()}
        label="board name"
        className="my-display-class"
      />,
    );
    expect(screen.getByRole("button")).toHaveClass("my-display-class");
  });

  it("applies custom inputClassName to the edit input", async () => {
    const input = await renderAndStartEditing({ value: "Test", inputClassName: "my-input-class" });
    expect(input).toHaveClass("my-input-class");
  });

  it("renders the pencil icon svg", () => {
    const { container } = render(
      <InlineEditText value="Test" onSave={vi.fn()} label="board name" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("prevents default on Enter to avoid form submission", async () => {
    const input = await renderAndStartEditing();
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      input.dispatchEvent(enterEvent);
    });

    expect(enterEvent.defaultPrevented).toBe(true);
  });

  it("stops propagation on Escape so surrounding dialogs don't close", async () => {
    const outerHandler = vi.fn();
    render(
      <div onKeyDown={outerHandler}>
        <InlineEditText value="Old" onSave={vi.fn()} label="board name" />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit board name" }));
    const input = screen.getByRole("textbox");
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      input.dispatchEvent(escapeEvent);
    });

    expect(outerHandler).not.toHaveBeenCalled();
  });

  it("updates draft as user types", async () => {
    const input = await renderAndStartEditing({ value: "" });
    await userEvent.type(input, "Hello World");
    expect(input).toHaveValue("Hello World");
  });

  it("covers disabled guard in startEditing", () => {
    render(<InlineEditText value="Test" onSave={vi.fn()} label="board name" disabled />);
    const button = screen.getByRole("button", { name: "Edit board name" });

    const reactPropsKey = Object.keys(button).find((k) => k.startsWith("__reactProps$"));
    const onClick = reactPropsKey
      ? (button as unknown as Record<string, { onClick?: () => void }>)[reactPropsKey]?.onClick
      : undefined;

    act(() => {
      onClick?.();
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("covers commit guard against double events", () => {
    const onSave = vi.fn();
    render(<InlineEditText value="Old" onSave={onSave} label="board name" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit board name" }));
    const input = screen.getByRole("textbox");

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.blur(input);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("covers cancel guard against double events", () => {
    const onSave = vi.fn();
    render(<InlineEditText value="Old" onSave={onSave} label="board name" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit board name" }));
    const input = screen.getByRole("textbox");

    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
