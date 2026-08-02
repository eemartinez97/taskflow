import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DropdownMenu } from "@/components/common/dropdown-menu";

describe("DropdownMenu", () => {
  it("is closed by default", () => {
    render(<DropdownMenu items={[{ label: "Edit", onClick: vi.fn() }]} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens on trigger click and toggles closed on a second click", async () => {
    render(<DropdownMenu items={[{ label: "Edit", onClick: vi.fn() }]} />);
    const trigger = screen.getByRole("button", { name: /open menu/i });
    const user = userEvent.setup();
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("invokes the item's onClick and closes the menu", async () => {
    const onClick = vi.fn();
    render(<DropdownMenu items={[{ label: "Edit", onClick }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /open menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on outside click", async () => {
    render(
      <div>
        <button>outside</button>
        <DropdownMenu items={[{ label: "Edit", onClick: vi.fn() }]} />
      </div>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /open menu/i }));
    await user.click(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<DropdownMenu items={[{ label: "Edit", onClick: vi.fn() }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /open menu/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("applies the danger styling class for danger items", async () => {
    render(<DropdownMenu items={[{ label: "Delete", onClick: vi.fn(), danger: true }]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass("text-red-600");
  });

  it("uses a custom trigger label when provided", () => {
    render(<DropdownMenu items={[]} triggerLabel="Custom trigger" />);
    expect(screen.getByRole("button", { name: "Custom trigger" })).toBeInTheDocument();
  });

  it("renders an item without an icon", async () => {
    render(<DropdownMenu items={[{ label: "No Icon" }] as never} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("menuitem", { name: "No Icon" })).toBeInTheDocument();
  });

  it("renders a menu item without an icon", async () => {
    render(<DropdownMenu items={[{ label: "No Icon", onClick: vi.fn() }]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("menuitem", { name: "No Icon" })).toBeInTheDocument();
  });

  it("does not close on a non-Escape key press", async () => {
    render(<DropdownMenu items={[{ label: "Edit", onClick: vi.fn() }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /open menu/i }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
