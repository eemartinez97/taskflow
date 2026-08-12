import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import ResetPasswordPage, { ResetPasswordGate } from "@/app/(auth)/reset-password/page";
import { getServerTRPC } from "@/lib/trpc/server";
import { mockGetServerTRPC } from "@/tests/support/trpc";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));

describe("ResetPasswordPage", () => {
  it("renders the new-password form when the token is valid", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      auth: { checkResetToken: vi.fn().mockResolvedValue({ valid: true }) },
    });
    const jsx = await ResetPasswordGate({
      searchParams: Promise.resolve({ token: "valid-token" }),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /choose a new password/i })).toBeInTheDocument();
  });

  it("renders the invalid-link state when the token is missing", async () => {
    const checkResetToken = vi.fn().mockResolvedValue({ valid: true });
    mockGetServerTRPC(vi.mocked(getServerTRPC), { auth: { checkResetToken } });
    const jsx = await ResetPasswordGate({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
    expect(checkResetToken).not.toHaveBeenCalled();
  });

  it("renders the invalid-link state when the token is expired/invalid", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      auth: { checkResetToken: vi.fn().mockResolvedValue({ valid: false }) },
    });
    const jsx = await ResetPasswordGate({
      searchParams: Promise.resolve({ token: "expired-token" }),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
  });

  it("renders the invalid-link state when the token query param is an array", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    const jsx = await ResetPasswordGate({ searchParams: Promise.resolve({ token: ["a", "b"] }) });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
  });

  it("renders a link to request a new reset link on the invalid state", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
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
