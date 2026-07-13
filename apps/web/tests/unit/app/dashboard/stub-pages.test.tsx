import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Stub pages are synchronous Server Components with zero dependencies.
 * No mocks required — render directly as JSX.
 */
import SettingsPage from "@/app/(dashboard)/settings/page";
import TasksPage from "@/app/(dashboard)/tasks/page";
import TeamPage from "@/app/(dashboard)/team/page";

describe("TasksPage", () => {
  it("renders the 'My Tasks' heading", () => {
    render(<TasksPage />);
    expect(screen.getByRole("heading", { name: /my tasks/i })).toBeInTheDocument();
  });

  it("renders the coming-soon message", () => {
    render(<TasksPage />);
    expect(screen.getByText(/coming in a future release/i)).toBeInTheDocument();
  });
});

describe("TeamPage", () => {
  it("renders the 'Team' heading", () => {
    render(<TeamPage />);
    expect(screen.getByRole("heading", { name: /^team$/i })).toBeInTheDocument();
  });

  it("renders the coming-soon message", () => {
    render(<TeamPage />);
    expect(screen.getByText(/coming in a future release/i)).toBeInTheDocument();
  });
});

describe("SettingsPage", () => {
  it("renders the 'Settings' heading", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders the coming-soon message", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/coming in a future release/i)).toBeInTheDocument();
  });
});
