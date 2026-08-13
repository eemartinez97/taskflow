import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PreferencesSettingsPage from "@/app/(dashboard)/settings/preferences/page";

describe("PreferencesSettingsPage", () => {
  it("renders the Preferences heading and the cursor preference card", () => {
    render(<PreferencesSettingsPage />);
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    // CursorPreference itself renders "Live cursors" as its own Card title.
    expect(screen.getByText("Live cursors")).toBeInTheDocument();
  });
});
