import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { CursorPreference } from "@/app/(dashboard)/settings/_components/cursor-preference";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { renderUI } from "../../helpers/render";

// -- Module mocks --

vi.mock("@/lib/hooks/use-cursors-pref", () => ({
  useCursorsHidden: vi.fn(() => ({ cursorsHidden: false, setCursorsHidden: vi.fn() })),
}));

import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";

// -- Tests --
describe("CursorPreference", () => {
  // -- Rendering --

  it("renders the 'Live cursors' card heading", () => {
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    expect(screen.getByText("Live cursors")).toBeInTheDocument();
  });

  it("renders the feature description text", () => {
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    expect(screen.getByText(/show teammates' cursors/i)).toBeInTheDocument();
  });

  // -- Visible state (cursors NOT hidden) --

  it("renders 'Visible' button text when cursors are visible (hidden=false)", () => {
    vi.mocked(useCursorsHidden).mockReturnValue({
      cursorsHidden: false,
      setCursorsHidden: vi.fn(),
    });
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    expect(screen.getByRole("button", { name: /visible/i })).toBeInTheDocument();
  });

  it("sets aria-pressed=true on the toggle button when cursors are visible", () => {
    vi.mocked(useCursorsHidden).mockReturnValue({
      cursorsHidden: false,
      setCursorsHidden: vi.fn(),
    });
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    expect(screen.getByRole("button", { name: /visible/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // -- Hidden state (cursors ARE hidden) --

  it("renders 'Hidden' button text when cursors are hidden (hidden=true)", () => {
    vi.mocked(useCursorsHidden).mockReturnValue({ cursorsHidden: true, setCursorsHidden: vi.fn() });
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    expect(screen.getByRole("button", { name: /hidden/i })).toBeInTheDocument();
  });

  it("sets aria-pressed=false on the toggle button when cursors are hidden", () => {
    vi.mocked(useCursorsHidden).mockReturnValue({ cursorsHidden: true, setCursorsHidden: vi.fn() });
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    expect(screen.getByRole("button", { name: /hidden/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  // -- Toggle interaction --

  it("calls setCursorsHidden(true) when toggled from visible to hidden", () => {
    const setCursorsHidden = vi.fn();
    vi.mocked(useCursorsHidden).mockReturnValue({ cursorsHidden: false, setCursorsHidden });
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /visible/i }));

    expect(setCursorsHidden).toHaveBeenCalledWith(true);
  });

  it("calls setCursorsHidden(false) when toggled from hidden to visible", () => {
    const setCursorsHidden = vi.fn();
    vi.mocked(useCursorsHidden).mockReturnValue({ cursorsHidden: true, setCursorsHidden });
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /hidden/i }));

    expect(setCursorsHidden).toHaveBeenCalledWith(false);
  });

  it("calls setCursorsHidden exactly once per click", () => {
    const setCursorsHidden = vi.fn();
    vi.mocked(useCursorsHidden).mockReturnValue({ cursorsHidden: false, setCursorsHidden });
    renderUI(<CursorPreference orgId={VALID_ORG_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /visible/i }));

    expect(setCursorsHidden).toHaveBeenCalledOnce();
  });
});
