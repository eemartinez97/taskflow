import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import ResetPasswordPage, { ResetPasswordGate } from "@/app/(auth)/reset-password/page";
import { findValidAuthToken } from "@/lib/auth/tokens";

vi.mock("@taskflow/database", () => ({ prisma: {} }));
vi.mock("@/lib/auth/tokens", () => ({ findValidAuthToken: vi.fn() }));

const mockFindValidAuthToken = vi.mocked(findValidAuthToken);

describe("ResetPasswordPage", () => {
  it("renders the new-password form when the token is valid", async () => {
    mockFindValidAuthToken.mockResolvedValue({ id: "token-1", userId: "user-1" });
    const jsx = await ResetPasswordGate({
      searchParams: Promise.resolve({ token: "valid-token" }),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /choose a new password/i })).toBeInTheDocument();
  });

  it("renders the invalid-link state when the token is missing", async () => {
    const jsx = await ResetPasswordGate({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
    expect(mockFindValidAuthToken).not.toHaveBeenCalled();
  });

  it("renders the invalid-link state when the token is expired/invalid", async () => {
    mockFindValidAuthToken.mockResolvedValue(null);
    const jsx = await ResetPasswordGate({
      searchParams: Promise.resolve({ token: "expired-token" }),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
  });

  it("renders the invalid-link state when the token query param is an array", async () => {
    const jsx = await ResetPasswordGate({ searchParams: Promise.resolve({ token: ["a", "b"] }) });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
  });

  it("renders a link to request a new reset link on the invalid state", async () => {
    const jsx = await ResetPasswordGate({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("default export wraps the gate in a Suspense boundary", () => {
    const element = ResetPasswordPage({ searchParams: Promise.resolve({}) });
    expect(element.type).toBe(Suspense);
    expect((element.props as { children: { type: unknown } }).children.type).toBe(
      ResetPasswordGate,
    );
  });
});
