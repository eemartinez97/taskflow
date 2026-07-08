import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ id: "u1", email: "u@test.com" }),
}));

import SettingsPage from "@/app/(dashboard)/settings/page";
import TasksPage from "@/app/(dashboard)/tasks/page";
import { requireSession } from "@/lib/auth/session";
import TeamPage from "@/app/(dashboard)/team/page";

describe("TasksPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the heading", async () => {
    render(await TasksPage());
    expect(screen.getByRole("heading", { name: /my tasks/i })).toBeInTheDocument();
  });

  it("calls requireSession", async () => {
    render(await TasksPage());
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it("renders the coming-soon message", async () => {
    render(await TasksPage());
    expect(screen.getByText(/coming in a future release/i)).toBeInTheDocument();
  });
});

describe("TeamPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the heading", async () => {
    render(await TeamPage());
    expect(screen.getByRole("heading", { name: /^team$/i })).toBeInTheDocument();
  });

  it("calls requireSession", async () => {
    render(await TeamPage());
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it("renders the coming-soon message", async () => {
    render(await TeamPage());
    expect(screen.getByText(/coming in a future release/i)).toBeInTheDocument();
  });
});

describe("SettingsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the heading", async () => {
    render(await SettingsPage());
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("calls requireSession", async () => {
    render(await SettingsPage());
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it("renders the coming-soon message", async () => {
    render(await SettingsPage());
    expect(screen.getByText(/coming in a future release/i)).toBeInTheDocument();
  });
});
