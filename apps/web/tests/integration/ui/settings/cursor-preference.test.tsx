import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { CursorPreference } from "@/app/(dashboard)/settings/_components/cursor-preference";
import { renderUI } from "../../helpers/render";

// -- Module mocks --

vi.mock("@/lib/hooks/use-cursors-pref", () => ({
  useCursorsHidden: vi.fn(() => false),
}));
vi.mock("@/lib/utils/cursor-pref", () => ({
  setCursorsHidden: vi.fn(),
  readCursorsHidden: vi.fn(() => false),
  subscribeCursorsPref: vi.fn(() => () => undefined),
  getServerCursorsHidden: vi.fn(() => false),
  CURSORS_PREF_COOKIE: "taskflow.cursorsHidden",
}));

import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";
import { setCursorsHidden } from "@/lib/utils/cursor-pref";

// -- Tests --
describe("CursorPreference", () => {
  // setCursorsHidden's call history is cleared by the global
  // vi.clearAllMocks() in tests/setup/integration.ui.ts afterEach.

  // -- Rendering --

  it("renders the 'Live cursors' card heading", () => {
    renderUI(<CursorPreference />);

    expect(screen.getByText("Live cursors")).toBeInTheDocument();
  });

  it("renders the feature description text", () => {
    renderUI(<CursorPreference />);

    expect(screen.getByText(/show teammates' cursors/i)).toBeInTheDocument();
  });

  // -- Visible state (cursors NOT hidden) --

  it("renders 'Visible' button text when cursors are visible (hidden=false)", () => {
    vi.mocked(useCursorsHidden).mockReturnValue(false);
    renderUI(<CursorPreference />);

    expect(screen.getByRole("button", { name: /visible/i })).toBeInTheDocument();
  });

  it("sets aria-pressed=true on the toggle button when cursors are visible", () => {
    vi.mocked(useCursorsHidden).mockReturnValue(false);
    renderUI(<CursorPreference />);

    expect(screen.getByRole("button", { name: /visible/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // -- Hidden state (cursors ARE hidden) --

  it("renders 'Hidden' button text when cursors are hidden (hidden=true)", () => {
    vi.mocked(useCursorsHidden).mockReturnValue(true);
    renderUI(<CursorPreference />);

    expect(screen.getByRole("button", { name: /hidden/i })).toBeInTheDocument();
  });

  it("sets aria-pressed=false on the toggle button when cursors are hidden", () => {
    vi.mocked(useCursorsHidden).mockReturnValue(true);
    renderUI(<CursorPreference />);

    expect(screen.getByRole("button", { name: /hidden/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  // -- Toggle interaction --

  it("calls setCursorsHidden(true) when toggled from visible to hidden", () => {
    vi.mocked(useCursorsHidden).mockReturnValue(false);
    renderUI(<CursorPreference />);

    fireEvent.click(screen.getByRole("button", { name: /visible/i }));

    expect(vi.mocked(setCursorsHidden)).toHaveBeenCalledWith(true);
  });

  it("calls setCursorsHidden(false) when toggled from hidden to visible", () => {
    vi.mocked(useCursorsHidden).mockReturnValue(true);
    renderUI(<CursorPreference />);

    fireEvent.click(screen.getByRole("button", { name: /hidden/i }));

    expect(vi.mocked(setCursorsHidden)).toHaveBeenCalledWith(false);
  });

  it("calls setCursorsHidden exactly once per click", () => {
    vi.mocked(useCursorsHidden).mockReturnValue(false);
    renderUI(<CursorPreference />);

    fireEvent.click(screen.getByRole("button", { name: /visible/i }));

    expect(vi.mocked(setCursorsHidden)).toHaveBeenCalledOnce();
  });
});
