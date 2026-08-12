import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import RegisterPage, { RegisterGate } from "@/app/(auth)/register/page";
import { getServerTRPC } from "@/lib/trpc/server";
import { mockGetServerTRPC } from "@/tests/support/trpc";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));

describe("RegisterPage", () => {
  it("renders the plain form with no invite banner when there's no ?invite param", async () => {
    const getByTokenPublic = vi.fn();
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { getByTokenPublic } });
    const jsx = await RegisterGate({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.queryByText(/you've been invited/i)).not.toBeInTheDocument();
    expect(getByTokenPublic).not.toHaveBeenCalled();
  });

  it("shows the invite banner when the token resolves to a VALID invitation", async () => {
    const getByTokenPublic = vi.fn().mockResolvedValue({
      email: "invitee@example.com",
      orgName: "Acme",
      role: "MEMBER",
      state: "VALID",
    });
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { getByTokenPublic } });
    const jsx = await RegisterGate({ searchParams: Promise.resolve({ invite: "raw-token" }) });
    render(jsx);
    expect(getByTokenPublic).toHaveBeenCalledWith({ token: "raw-token" });
    expect(screen.getByText(/you've been invited/i)).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("falls back to the plain form when the invitation is no longer VALID", async () => {
    const getByTokenPublic = vi.fn().mockResolvedValue({
      email: "invitee@example.com",
      orgName: "Acme",
      role: "MEMBER",
      state: "REVOKED",
    });
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { getByTokenPublic } });
    const jsx = await RegisterGate({ searchParams: Promise.resolve({ invite: "raw-token" }) });
    render(jsx);
    expect(screen.queryByText(/you've been invited/i)).not.toBeInTheDocument();
  });

  it("falls back to the plain form when the token doesn't resolve at all", async () => {
    const getByTokenPublic = vi.fn().mockRejectedValue(new Error("NOT_FOUND"));
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { getByTokenPublic } });
    const jsx = await RegisterGate({ searchParams: Promise.resolve({ invite: "bad-token" }) });
    render(jsx);
    expect(screen.queryByText(/you've been invited/i)).not.toBeInTheDocument();
  });

  it("ignores an array ?invite query param as if there were none", async () => {
    const getByTokenPublic = vi.fn();
    mockGetServerTRPC(vi.mocked(getServerTRPC), { invitations: { getByTokenPublic } });
    const jsx = await RegisterGate({ searchParams: Promise.resolve({ invite: ["a", "b"] }) });
    render(jsx);
    expect(getByTokenPublic).not.toHaveBeenCalled();
  });

  it("default export wraps the gate in a Suspense boundary", () => {
    const element = RegisterPage({ searchParams: Promise.resolve({}) });
    expect(element.type).toBe(Suspense);
    expect((element.props as { children: { type: unknown } }).children.type).toBe(RegisterGate);
  });
});
