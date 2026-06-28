import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => import("../../mocks/next-link"));

import HomePage from "../../../app/page.js";

describe("HomePage", () => {
  it("renders the TaskFlow heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "TaskFlow" })).toBeInTheDocument();
  });

  it("renders the product description", () => {
    render(<HomePage />);
    expect(
      screen.getByText("Project management with real-time collaboration."),
    ).toBeInTheDocument();
  });

  it("renders a Sign in link pointing to /login", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders a Create account link pointing to /register", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: "Create account" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/register");
  });

  it("renders both CTA links in a <main> element", () => {
    render(<HomePage />);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main.querySelectorAll("a")).toHaveLength(2);
  });

  it("Sign in link has brand-600 background class", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass("bg-brand-600");
  });
});
