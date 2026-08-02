import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AddColumnButton } from "@/components/kanban/add-column-button";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("AddColumnButton", () => {
  it("shows the collapsed '+' trigger initially", () => {
    render(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    expect(screen.getByRole("button", { name: /add column/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/new column name/i)).not.toBeInTheDocument();
  });

  it("expands the input on trigger click", async () => {
    render(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /add column/i }));
    expect(screen.getByLabelText(/new column name/i)).toBeInTheDocument();
  });

  it("submits the trimmed name on Enter and clears the input", async () => {
    const onAdd = vi.fn();
    render(<AddColumnButton onAdd={onAdd} columnCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add column/i }));
    await user.type(screen.getByLabelText(/new column name/i), "  Doing  {Enter}");
    expect(onAdd).toHaveBeenCalledWith("Doing");
    expect(screen.getByLabelText(/new column name/i)).toHaveValue("");
  });

  it("submits via the confirm icon button", async () => {
    const onAdd = vi.fn();
    render(<AddColumnButton onAdd={onAdd} columnCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add column/i }));
    await user.type(screen.getByLabelText(/new column name/i), "Doing");
    await user.click(screen.getByRole("button", { name: /confirm new column/i }));
    expect(onAdd).toHaveBeenCalledWith("Doing");
  });

  it("does not submit an empty/whitespace-only name", async () => {
    const onAdd = vi.fn();
    render(<AddColumnButton onAdd={onAdd} columnCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add column/i }));
    await user.type(screen.getByLabelText(/new column name/i), "   {Enter}");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("cancels and collapses on Escape", async () => {
    render(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add column/i }));
    await user.type(screen.getByLabelText(/new column name/i), "Draft");
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText(/new column name/i)).not.toBeInTheDocument();
  });

  it("collapses automatically on blur with an empty value", async () => {
    render(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add column/i }));
    await user.tab();
    expect(screen.queryByLabelText(/new column name/i)).not.toBeInTheDocument();
  });

  it("shows an 'Adding…' button while loading", async () => {
    render(<AddColumnButton onAdd={vi.fn()} columnCount={0} loading />);
    await userEvent.setup().click(screen.getByRole("button", { name: /add column/i }));
    expect(screen.getByRole("button", { name: /adding/i })).toBeInTheDocument();
  });

  it("disables confirm when the input is empty", async () => {
    render(<AddColumnButton onAdd={vi.fn()} columnCount={0} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /add column/i }));
    expect(screen.getByRole("button", { name: /confirm new column/i })).toBeDisabled();
  });
});
