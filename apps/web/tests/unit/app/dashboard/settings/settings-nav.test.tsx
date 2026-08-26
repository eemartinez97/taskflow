import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePathname } from "next/navigation";
import { SettingsNav } from "@/app/(dashboard)/settings/_components/settings-nav";

describe("SettingsNav", () => {
  it("always renders the Account group's Profile and Preferences links", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    render(<SettingsNav orgName={null} role={null} />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/settings/profile",
    );
    expect(screen.getByRole("link", { name: "Preferences" })).toHaveAttribute(
      "href",
      "/settings/preferences",
    );
  });

  it("marks the current route with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    render(<SettingsNav orgName={null} role={null} />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Preferences" })).not.toHaveAttribute("aria-current");
  });

  it("hides the organization group entirely when there is no org", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    render(<SettingsNav orgName={null} role="OWNER" />);
    expect(screen.queryByRole("link", { name: "General" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Labels" })).not.toBeInTheDocument();
  });

  it("shows the org name as the group label and both links for an OWNER", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    render(<SettingsNav orgName="Acme Corp" role="OWNER" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/settings/organization",
    );
    expect(screen.getByRole("link", { name: "Labels" })).toHaveAttribute(
      "href",
      "/settings/labels",
    );
  });

  it("shows General for an ADMIN", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    render(<SettingsNav orgName="Acme Corp" role="ADMIN" />);
    expect(screen.getByRole("link", { name: "General" })).toBeInTheDocument();
  });

  it("hides General but shows Labels for a MEMBER", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    render(<SettingsNav orgName="Acme Corp" role="MEMBER" />);
    expect(screen.queryByRole("link", { name: "General" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Labels" })).toBeInTheDocument();
  });

  it("hides the entire organization group for a VIEWER", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/profile");
    render(<SettingsNav orgName="Acme Corp" role="VIEWER" />);
    expect(screen.queryByRole("link", { name: "General" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Labels" })).not.toBeInTheDocument();
  });
});
