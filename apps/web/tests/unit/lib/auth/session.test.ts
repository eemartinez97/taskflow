import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => import("@/tests/mocks/server-only"));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { getSession } from "@/lib/auth/session";
import { mockSession } from "@/tests/support/fixtures";

describe("getSession", () => {
  it("returns null when there is no session", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    expect(await getSession()).toBeNull();
  });

  it("returns null when session.user.id is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      ...mockSession,
      user: { ...mockSession.user, id: "" },
    });
    expect(await getSession()).toBeNull();
  });

  it("returns null when session.user.email is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      ...mockSession,
      user: { ...mockSession.user, email: undefined as unknown as string },
    });
    expect(await getSession()).toBeNull();
  });

  it("returns a normalized SessionUser, defaulting name/image to null", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      ...mockSession,
      user: { ...mockSession.user, name: undefined, image: undefined },
    });
    const result = await getSession();
    expect(result).toEqual({
      id: mockSession.user.id,
      email: mockSession.user.email,
      name: null,
      image: null,
    });
  });
});
