import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProfileSettingsPage from "@/app/(dashboard)/settings/profile/page";

describe("ProfileSettingsPage", () => {
  it("renders the Profile heading and the profile form", () => {
    render(<ProfileSettingsPage />);
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    // ProfileForm itself renders "Your profile" as its own Card title.
    expect(screen.getByText("Your profile")).toBeInTheDocument();
  });
});
