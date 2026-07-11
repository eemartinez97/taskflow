import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server-session", () => ({ getServerSessionFromHeaders: vi.fn() }));
vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation"));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("server-only");

import { headers } from "next/headers";

import { getServerSessionFromHeaders } from "@/lib/auth/server-session";
import { getSession, requireSession } from "@/lib/auth/session";
import { makeHeaders, makeSessionHeaders, mockServerSessionUser } from "@/tests/helpers";
import { redirect } from "@/tests/mocks/next-navigation";

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the request headers to getServerSessionFromHeaders", async () => {
    const h = makeSessionHeaders("tok");
    vi.mocked(headers).mockResolvedValueOnce(h);
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(null);

    await getSession();

    expect(getServerSessionFromHeaders).toHaveBeenCalledWith(h);
  });

  it("returns the session when authenticated", async () => {
    vi.mocked(headers).mockResolvedValueOnce(makeHeaders());
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(mockServerSessionUser);
    expect(await getSession()).toEqual(mockServerSessionUser);
  });

  it("returns null when unauthenticated", async () => {
    vi.mocked(headers).mockResolvedValueOnce(makeHeaders());
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(null);
    expect(await getSession()).toBeNull();
  });
});

describe("requireSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValueOnce(makeHeaders());
  });

  it("returns the session user when authenticated", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(mockServerSessionUser);
    expect(await requireSession()).toBe(mockServerSessionUser);
  });

  it("calls redirect('/login') when session is null", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(null);
    await requireSession().catch(() => undefined);

    // redirect was called with /login
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("does NOT call redirect when session exists", async () => {
    vi.mocked(getServerSessionFromHeaders).mockResolvedValueOnce(mockServerSessionUser);
    await requireSession();
    expect(redirect).not.toHaveBeenCalled();
  });
});
