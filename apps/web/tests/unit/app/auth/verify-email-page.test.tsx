import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendAccountActivatedEmail } from "@taskflow/mail";
import VerifyEmailPage, { VerifyEmailGate } from "@/app/(auth)/verify-email/page";
import { TokenGateFallback } from "@/app/(auth)/_components/token-gate";
import { verifyEmailFromToken } from "@/lib/auth/tokens";

vi.mock("@taskflow/database", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@taskflow/mail", () => ({ sendAccountActivatedEmail: vi.fn() }));
vi.mock("@/lib/auth/tokens", () => ({ verifyEmailFromToken: vi.fn() }));
vi.mock("@/lib/mail/sender", () => ({ emailSender: {} }));
vi.mock("@/lib/env.server", () => ({ serverEnv: { NEXTAUTH_URL: "https://taskflow.dev" } }));
// `after()` only works inside a real Next.js request scope - outside of one
// (as in this unit test) it schedules nothing. Capturing the task lets each
// test invoke it explicitly and assert on what it does when Next actually
// runs it, without needing a live request context.
vi.mock("next/server", () => ({ after: vi.fn() }));

const mockVerifyEmailFromToken = vi.mocked(verifyEmailFromToken);
const mockSendAccountActivatedEmail = vi.mocked(sendAccountActivatedEmail);
const mockAfter = vi.mocked(after);

async function importPrismaMock() {
  const { prisma } = await import("@taskflow/database");
  return vi.mocked(prisma.user.findUnique);
}

/** Runs the task most recently handed to `after()`, as Next would post-response. */
async function runDeferredTask(): Promise<void> {
  const task = mockAfter.mock.calls.at(-1)?.[0];
  if (typeof task === "function") await task();
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login?activated=1 when the token verifies the account", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: false,
      userId: "user-1",
    });
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      VerifyEmailGate({ searchParams: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockVerifyEmailFromToken).toHaveBeenCalledWith(expect.anything(), "valid-token");
    expect(redirect).toHaveBeenCalledWith("/login?activated=1");
  });

  it("schedules the account-activated email via after() exactly once for a freshly activated account", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: "user-1",
    });
    const mockFindUnique = await importPrismaMock();
    mockFindUnique.mockResolvedValue({ email: "ada@taskflow.dev", name: "Ada" } as never);
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      VerifyEmailGate({ searchParams: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    // The redirect must not wait on the scheduled task - only after() itself.
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockSendAccountActivatedEmail).not.toHaveBeenCalled();

    await runDeferredTask();

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { email: true, name: true },
    });
    expect(mockSendAccountActivatedEmail).toHaveBeenCalledTimes(1);
    expect(mockSendAccountActivatedEmail).toHaveBeenCalledWith(
      {},
      { to: "ada@taskflow.dev", name: "Ada", loginUrl: "https://taskflow.dev/login" },
    );
  });

  it("falls back to the email address when the user has no name", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: "user-1",
    });
    const mockFindUnique = await importPrismaMock();
    mockFindUnique.mockResolvedValue({ email: "ada@taskflow.dev", name: null } as never);
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      VerifyEmailGate({ searchParams: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    await runDeferredTask();

    expect(mockSendAccountActivatedEmail).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ name: "ada@taskflow.dev" }),
    );
  });

  it("does not schedule the account-activated email on a repeat visit to an already-consumed link", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: false,
      userId: "user-1",
    });
    const mockFindUnique = await importPrismaMock();
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      VerifyEmailGate({ searchParams: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSendAccountActivatedEmail).not.toHaveBeenCalled();
  });

  it("the deferred task no-ops when the notification user lookup finds no user", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: "ghost-user",
    });
    const mockFindUnique = await importPrismaMock();
    mockFindUnique.mockResolvedValue(null);
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      VerifyEmailGate({ searchParams: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?activated=1");

    await expect(runDeferredTask()).resolves.toBeUndefined();
    expect(mockSendAccountActivatedEmail).not.toHaveBeenCalled();
  });

  it("the deferred task swallows and logs a delivery failure instead of throwing", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: "user-1",
    });
    const mockFindUnique = await importPrismaMock();
    mockFindUnique.mockResolvedValue({ email: "ada@taskflow.dev", name: "Ada" } as never);
    mockSendAccountActivatedEmail.mockRejectedValueOnce(new Error("delivery failed"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      VerifyEmailGate({ searchParams: Promise.resolve({ token: "valid-token" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?activated=1");

    await expect(runDeferredTask()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[VerifyEmailGate] failed to send account-activated email:",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it("renders the invalid-link state when the token is missing", async () => {
    const jsx = await VerifyEmailGate({
      searchParams: Promise.resolve({}),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: /link invalid or expired/i })).toBeInTheDocument();
    expect(mockVerifyEmailFromToken).not.toHaveBeenCalled();
  });

  it("renders the invalid-link state when the token is expired/invalid", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({ verified: false });
    const jsx = await VerifyEmailGate({
      searchParams: Promise.resolve({ token: "expired-token" }),
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
    expect(mockVerifyEmailFromToken).not.toHaveBeenCalled();
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
    expect((element.props as { children: { type: unknown } }).children.type).toBe(
      VerifyEmailGate,
    );
  });

  it("Suspense fallback renders a loading skeleton with the given title", () => {
    render(<TokenGateFallback title="Confirm your email" />);
    expect(screen.getByRole("heading", { name: /confirm your email/i })).toBeInTheDocument();
  });
});
