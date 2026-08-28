import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => import("@/tests/mocks/server-only"));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database"));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn() } }));

import { getServerSession } from "next-auth";
import { __resetLastSeenThrottleForTest, getSession } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";
import { mockSession } from "@/tests/support/fixtures";
import { mockDb } from "@/tests/mocks/taskflow-database";

describe("getSession", () => {
  beforeEach(() => {
    __resetLastSeenThrottleForTest();
    mockDb.user.update.mockResolvedValue({});
  });

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

  describe("lastSeenAt tracking", () => {
    it("touches lastSeenAt for a valid session, without blocking the response", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);

      await getSession();
      await vi.waitFor(() => {
        expect(mockDb.user.update).toHaveBeenCalledWith({
          where: { id: mockSession.user.id },
          data: { lastSeenAt: expect.any(Date) as Date },
        });
      });
    });

    it("does not touch lastSeenAt when there is no session", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      await getSession();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockDb.user.update).not.toHaveBeenCalled();
    });

    it("throttles: a second call within the window does not write again", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      await getSession();
      await getSession();
      await vi.waitFor(() => {
        expect(mockDb.user.update).toHaveBeenCalledTimes(1);
      });
    });

    it("logs (does not throw) when the update fails", async () => {
      mockDb.user.update.mockRejectedValueOnce(new Error("DB unavailable"));
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);

      await expect(getSession()).resolves.toMatchObject({ id: mockSession.user.id });
      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({ userId: mockSession.user.id }) as unknown,
          "getSession: failed to update lastSeenAt",
        );
      });
    });
  });
});
