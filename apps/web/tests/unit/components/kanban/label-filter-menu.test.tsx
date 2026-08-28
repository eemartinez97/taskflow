import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LabelFilterMenu } from "@/components/kanban/label-filter-menu";

const LABEL_BUG = {
  id: "l1",
  orgId: "org-1",
  name: "Bug",
  color: "#EF4444",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const LABEL_FEATURE = {
  id: "l2",
  orgId: "org-1",
  name: "Feature",
  color: "#3B82F6",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("LabelFilterMenu", () => {
  it("renders nothing when the org has no labels", () => {
    const { container } = render(
      <LabelFilterMenu orgLabels={[]} activeLabelIds={[]} onToggle={vi.fn()} onClear={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the menu and lists every label as a toggle chip", async () => {
    render(
      <LabelFilterMenu
        orgLabels={[LABEL_BUG, LABEL_FEATURE]}
        activeLabelIds={[]}
        onToggle={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /^filter$/i }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feature" })).toBeInTheDocument();
  });

  it("shows an active count badge and calls onToggle when a chip is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <LabelFilterMenu
        orgLabels={[LABEL_BUG]}
        activeLabelIds={[LABEL_BUG.id]}
        onToggle={onToggle}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /filter/i })).toHaveTextContent("1");

    await userEvent.setup().click(screen.getByRole("button", { name: /filter/i }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Bug" }));
    expect(onToggle).toHaveBeenCalledWith(LABEL_BUG.id);
    expect(screen.getByRole("button", { name: "Bug" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the Clear button only when a filter is active, and calls onClear when clicked", async () => {
    const onClear = vi.fn();
    render(
      <LabelFilterMenu
        orgLabels={[LABEL_BUG]}
        activeLabelIds={[LABEL_BUG.id]}
        onToggle={vi.fn()}
        onClear={onClear}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("does not render Clear when no filter is active", async () => {
    render(
      <LabelFilterMenu
        orgLabels={[LABEL_BUG]}
        activeLabelIds={[]}
        onToggle={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /^filter$/i }));
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("closes on outside click", async () => {
    render(
      <div>
        <LabelFilterMenu
          orgLabels={[LABEL_BUG]}
          activeLabelIds={[]}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />
        <button type="button">outside</button>
      </div>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filter$/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape but stays open for any other key", async () => {
    render(
      <LabelFilterMenu
        orgLabels={[LABEL_BUG]}
        activeLabelIds={[]}
        onToggle={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^filter$/i }));

    await user.keyboard("{a}");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
