import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, type DropdownItem } from "@/components/common/dropdown-menu";
import { renderUI } from "../../helpers/render";

// -- Shared fixtures --

function buildItems(overrides: Partial<DropdownItem>[] = []): DropdownItem[] {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const defaults: DropdownItem[] = [
    { label: "Edit", icon: Pencil, onClick: onEdit },
    { label: "Delete", icon: Trash2, danger: true, onClick: onDelete },
  ];
  return defaults.map((item, i) => ({ ...item, ...overrides[i] }));
}

const TRIGGER_LABEL = "Options for project";

// -- Tests --

describe("DropdownMenu", () => {
  // -- Rendering --

  it("renders the trigger button with the default 'Open menu' label", () => {
    renderUI(<DropdownMenu items={buildItems()} />);

    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });

  it("renders the trigger button with a custom triggerLabel", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);

    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toBeInTheDocument();
  });

  it("does not render the menu on initial render", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("sets aria-expanded='false' on the trigger when closed", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);

    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("sets aria-haspopup='menu' on the trigger", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);

    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );
  });

  // -- Open / close --

  it("opens the menu when the trigger is clicked", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("sets aria-expanded='true' when the menu is open", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));

    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("renders all items inside the menu when open", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));

    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("closes the menu when the trigger is clicked a second time (toggle)", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    const trigger = screen.getByRole("button", { name: TRIGGER_LABEL });

    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu on a mousedown event outside the component", async () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("closes the menu when the Escape key is pressed", async () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  // -- Item interaction --

  it("calls the item's onClick when a menu item is clicked", () => {
    const items = buildItems();
    renderUI(<DropdownMenu items={items} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    const editItem = items.find((item) => item.label === "Edit");
    expect(editItem).toBeDefined();
    expect(editItem?.onClick).toHaveBeenCalledOnce();
  });

  it("closes the menu after an item is clicked", () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls the danger item's onClick when clicked", () => {
    const items = buildItems();
    renderUI(<DropdownMenu items={items} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const deleteItem = items.find((item) => item.label === "Delete");
    expect(deleteItem).toBeDefined();
    expect(deleteItem?.onClick).toHaveBeenCalledOnce();
  });

  it("does not close the menu on a mousedown inside the component", async () => {
    renderUI(<DropdownMenu items={buildItems()} triggerLabel={TRIGGER_LABEL} />);
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }));

    fireEvent.mouseDown(screen.getByRole("menu"));

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
  });
});
