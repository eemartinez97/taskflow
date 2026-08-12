import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import VerifyEmailPage, { VerifyEmailGate } from "@/app/(auth)/verify-email/page";
import { TokenGateFallback } from "@/app/(auth)/_components/token-gate";
import { apiHttpClient } from "@/lib/trpc/http-server";

vi.mock("@/lib/trpc/http-server", () => ({
  apiHttpClient: { auth: { verifyEmail: { mutate: vi.fn() } } },
}));

const mockVerifyEmail = vi.mocked(apiHttpClient.auth.verifyEmail.mutate);

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login?activated=1 when the token verifies the account", async () => {
    mockVerifyEmail.mockResolvedValue({ verified: true });
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      VerifyEmailGate({ searchParams: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockVerifyEmail).toHaveBeenCalledWith({ token: "valid-token" });
    expect(redirect).toHaveBeenCalledWith("/login?activated=1");
  });

  it("renders the invalid-link state when the token is missing", async () => {
    const jsx = await VerifyEmailGate({
      searchParams: Promise.resolve({}),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it("renders the invalid-link state when the token is expired/invalid", async () => {
    mockVerifyEmail.mockResolvedValue({ verified: false });
    const jsx = await VerifyEmailGate({
      searchParams: Promise.resolve({ token: "expired-token" }),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
  });

  it("renders the invalid-link state when apps/api is unreachable", async () => {
    mockVerifyEmail.mockRejectedValue(new Error("fetch failed"));
    const jsx = await VerifyEmailGate({
      searchParams: Promise.resolve({ token: "some-token" }),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
  });

  it("renders the invalid-link state when the token query param is an array", async () => {
    const jsx = await VerifyEmailGate({
      searchParams: Promise.resolve({ token: ["a", "b"] }),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it("renders a link back to registration on the invalid state", async () => {
    const jsx = await VerifyEmailGate({
      searchParams: Promise.resolve({}),
    });
    render(jsx);
    expect(screen.getByRole("link", { name: /back to registration/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("default export wraps the gate in a Suspense boundary", () => {
    // The default export is a plain (sync) Server Component - it can be
    // invoked directly as a function without going through ReactDOM, which
    // does not support rendering async Server Components on the client.
    const element = VerifyEmailPage({ searchParams: Promise.resolve({}) });
    expect(element.type).toBe(Suspense);
    expect((element.props as { children: { type: unknown } }).children.type).toBe(VerifyEmailGate);
  });

  it("Suspense fallback renders a loading skeleton with the given title", () => {
    render(<TokenGateFallback title="Confirm your email" />);
    expect(screen.getByRole("heading", { name: /confirm your email/i })).toBeInTheDocument();
  });
});
