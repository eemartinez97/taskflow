import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));

import { signOut, useSession } from "@/tests/mocks/next-auth";
import { mockSession } from "@/tests/mocks/next-auth";
import { Header } from "@/components/layout/header";

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: vi.fn().mockResolvedValue(mockSession),
    });
  });

  it("renders the page title", () => {
    render(<Header title="Projects" />);
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
  });

  it("renders user initials from session name", () => {
    render(<Header title="Projects" />);
    expect(screen.getByLabelText(/user: alice/i)).toBeInTheDocument();
  });

  it("renders '??' initials when user has no name", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, name: null } },
      status: "authenticated",
      update: vi.fn().mockResolvedValue(mockSession),
    });
    render(<Header title="Projects" />);
    expect(screen.getByLabelText(/user: unknown/i)).toBeInTheDocument();
  });

  it("renders the sign-out button", () => {
    render(<Header title="Projects" />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("calls signOut when the sign-out button is clicked", async () => {
    render(<Header title="Projects" />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
