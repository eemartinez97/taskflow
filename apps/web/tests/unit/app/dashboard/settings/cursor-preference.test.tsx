import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const setCursorsHidden = vi.fn();
let mockHiddenValue = false;
vi.mock("@/lib/hooks/use-cursors-pref", () => ({
  useCursorsHidden: () => ({ cursorsHidden: mockHiddenValue, setCursorsHidden }),
}));

import { CursorPreference } from "@/app/(dashboard)/settings/_components/cursor-preference";
import { VALID_ORG_ID } from "@/tests/support/fixtures";

describe("CursorPreference", () => {
  it("renders visible state and toggles to hidden", () => {
    mockHiddenValue = false;
    render(<CursorPreference orgId={VALID_ORG_ID} />);
    expect(screen.getByRole("button", { name: /visible/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /visible/i }));
    expect(setCursorsHidden).toHaveBeenCalledWith(true);
  });

  it("renders hidden state and toggles to visible", () => {
    mockHiddenValue = true;
    render(<CursorPreference orgId={VALID_ORG_ID} />);
    expect(screen.getByRole("button", { name: /hidden/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /hidden/i }));
    expect(setCursorsHidden).toHaveBeenCalledWith(false);
  });
});
