import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { SettingsNav } from "@/app/(dashboard)/settings/_components/settings-nav";
import { renderUI } from "../../helpers/render";

describe("SettingsNav", () => {
  it("renders the Account group's links", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    renderUI(<SettingsNav orgName={null} role={null} />);

    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Preferences" })).toBeInTheDocument();
  });

  it("hides the organization group when there is no org", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    renderUI(<SettingsNav orgName={null} role="OWNER" />);

    expect(screen.queryByRole("link", { name: "General" })).not.toBeInTheDocument();
  });

  it("shows General and Labels for an OWNER, labeled with the org name", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    renderUI(<SettingsNav orgName="Acme Corp" role="OWNER" />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Labels" })).toBeInTheDocument();
  });

  it("hides General for a MEMBER but keeps Labels", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    renderUI(<SettingsNav orgName="Acme Corp" role="MEMBER" />);

    expect(screen.queryByRole("link", { name: "General" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Labels" })).toBeInTheDocument();
  });

  it("hides both org links for a VIEWER", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    renderUI(<SettingsNav orgName="Acme Corp" role="VIEWER" />);

    expect(screen.queryByRole("link", { name: "General" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Labels" })).not.toBeInTheDocument();
  });

  it("marks the active route with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/preferences");
    renderUI(<SettingsNav orgName={null} role={null} />);

    expect(screen.getByRole("link", { name: "Preferences" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
