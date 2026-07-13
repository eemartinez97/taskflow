import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("server-only");

import { getServerSession } from "next-auth";

import { VALID_USER_ID, mockSession, mockServerSessionUser } from "@/tests/helpers";
import { getSession } from "@/lib/auth/session";

/**
 * Builds a minimal NextAuth Session-shaped object for edge-case tests.
 * `mockSession` from helpers covers the happy path.
 */
function makeSession(
  overrides: Partial<{ id: string; email: string; name: string | null; image: string | null }>,
) {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: { ...mockSession.user, ...overrides },
  };
}

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a SessionUser matching mockServerSessionUser on a valid session", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    expect(await getSession()).toEqual(mockServerSessionUser);
  });

  it("returns null when getServerSession returns null", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    expect(await getSession()).toBeNull();
  });

  it("returns null when user.id is an empty string", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(makeSession({ id: "" }));
    expect(await getSession()).toBeNull();
  });

  it("returns null when user.email is an empty string", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(makeSession({ email: "" }));
    expect(await getSession()).toBeNull();
  });

  it("coerces undefined name to null", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(
      makeSession({ name: undefined as unknown as null }),
    );
    const result = await getSession();
    expect(result?.name).toBeNull();
  });

  it("coerces null name to null", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(makeSession({ name: null }));
    expect((await getSession())?.name).toBeNull();
  });

  it("coerces null image to null", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(makeSession({ image: null }));
    expect((await getSession())?.image).toBeNull();
  });

  it("maps user.id from the session", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    expect((await getSession())?.id).toBe(VALID_USER_ID);
  });

  it("calls getServerSession exactly once", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    await getSession();
    expect(getServerSession).toHaveBeenCalledOnce();
  });
});
