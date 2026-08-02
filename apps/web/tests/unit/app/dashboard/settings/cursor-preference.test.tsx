import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let mockHiddenValue = false;
vi.mock("@/lib/hooks/use-cursors-pref", () => ({ useCursorsHidden: () => mockHiddenValue }));
vi.mock("@/lib/utils/cursor-pref", () => ({ setCursorsHidden: vi.fn() }));

import { setCursorsHidden } from "@/lib/utils/cursor-pref";
import { CursorPreference } from "@/app/(dashboard)/settings/_components/cursor-preference";

describe("CursorPreference", () => {
  it("renders visible state and toggles to hidden", () => {
    mockHiddenValue = false;
    render(<CursorPreference />);
    expect(screen.getByRole("button", { name: /visible/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /visible/i }));
    expect(setCursorsHidden).toHaveBeenCalledWith(true);
  });

  it("renders hidden state and toggles to visible", () => {
    mockHiddenValue = true;
    render(<CursorPreference />);
    expect(screen.getByRole("button", { name: /hidden/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /hidden/i }));
    expect(setCursorsHidden).toHaveBeenCalledWith(false);
  });
});
