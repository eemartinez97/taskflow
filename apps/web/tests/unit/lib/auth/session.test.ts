import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => import("@/tests/mocks/next-auth-server.js"));
vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation.js"));
vi.mock("@/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth/next";

import { getSession, requireSession } from "@/lib/auth/session.js";
import { mockSession } from "@/tests/mocks/next-auth.js";
import { redirect } from "@/tests/mocks/next-navigation";

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls getServerSession with authOptions", async () => {
    await getSession();
    expect(getServerSession).toHaveBeenCalledOnce();
  });

  it("returns the session from getServerSession", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    expect(await getSession()).toBe(mockSession);
  });

  it("returns null when getServerSession returns null", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    expect(await getSession()).toBeNull();
  });
});

describe("requireSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the session when authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    const session = await requireSession();
    expect(session).toBe(mockSession);
  });

  it("calls redirect('/login') when session is null", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    await requireSession().catch(() => undefined);

    // redirect was called with /login
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("does NOT call redirect when session exists", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    await requireSession();
    expect(redirect).not.toHaveBeenCalled();
  });
});
