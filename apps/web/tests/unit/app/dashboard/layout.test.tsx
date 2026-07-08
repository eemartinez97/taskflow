import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation.js"));
vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth.js"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui.js"));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));
vi.mock("next/link", () => import("@/tests/mocks/next-link.js"));

import { redirect } from "@/tests/mocks/next-navigation";
import DashboardLayout from "@/app/(dashboard)/layout";
import { requireSession } from "@/lib/auth/session";
import { mockAuthorizedUser } from "@/tests/helpers";

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockAuthorizedUser);
  });

  it("renders children when session is valid", async () => {
    const layout = await DashboardLayout({ children: <p>page content</p> });
    render(layout);
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("calls requireSession", async () => {
    const layout = await DashboardLayout({ children: <span /> });
    render(layout);
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it("calls redirect('/login') when session is null", async () => {
    vi.mocked(requireSession).mockImplementationOnce(() => {
      redirect("/login");
      // redirect() throws in Next.js; simulate that:
      throw new Error("NEXT_REDIRECT");
    });

    await expect(DashboardLayout({ children: <span /> })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders a <main> element with id='main-content'", async () => {
    const layout = await DashboardLayout({ children: <span>inner</span> });
    render(layout);
    expect(document.getElementById("main-content")).toBeInTheDocument();
  });

  it("renders children inside the <main> element", async () => {
    const layout = await DashboardLayout({ children: <p data-testid="child">hello</p> });
    render(layout);
    const main = document.getElementById("main-content");
    expect(main?.querySelector("[data-testid='child']")).toBeInTheDocument();
  });
});
